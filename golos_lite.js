const { curly } = require('node-libcurl');
const golos = require('golos-lib-js');

//==============================================================================

async function getHistory(url, account, from, limit) {

  try {
    const { data } = await curly.post(url, {
      postFields: '{"id":1,"method":"call","jsonrpc":"2.0","params":["account_history","get_account_history",["' +
        account+'", "'+from+'", "'+limit+'"] ]}',
      httpHeader: [
        'Content-Type: application/json',
        'Accept: application/json'
      ],
    });

    let json  = JSON.parse(data);
    return json.result;
  }
  catch (error) {
    console.warn("getHistory error: " + error.message);
  }
}

//==============================================================================

async function getLiquidBalance(url, account) {

  try {
    const { data } = await curly.post(url, {
      postFields: '{"id":1,"method":"call","jsonrpc":"2.0","params":["database_api","get_accounts",[["'+account+'"]]]}',
      httpHeader: [
        'Content-Type: application/json',
        'Accept: application/json'
      ],
    });

    let json  = JSON.parse(data);
    return json.result[0].balance;
  }
  catch (error) {
    console.warn("getLiquidBalance error: " + error.message);
  }
}

//==============================================================================

async function get_head_block_num (url) {

  try {
    const { data } = await curly.post(url, {
      postFields: '{"id":1,"method":"call","jsonrpc":"2.0","params":["database_api","get_dynamic_global_properties",[] ]}',
      httpHeader: [
        'Content-Type: application/json',
        'Accept: application/json'
      ],
     });

    let json  = JSON.parse(data);
    return json.result.head_block_number;
  }
  catch (error) {
    console.warn("get_head_block_num: " + error.message);
  }
}

//==============================================================================

async function get_block_header(url, param) {

  try {
    const { data } = await curly.post(url, {
      postFields: '{"id":1,"method":"call","jsonrpc":"2.0","params":["database_api","get_block_header",["' + param + '"] ]}',
      httpHeader: [
        'Content-Type: application/json',
        'Accept: application/json'
      ],
     });

    let json  = JSON.parse(data);
    return json.result;
  }
  catch (error) {
    console.warn("get_block_header: " + error.message);
  }

}

//==============================================================================

async function doTransfer(url, wif, account, golos_acc, amount_str, memo) {

  try {
    let head_block_number = await get_head_block_num(url);
    let ref_block_num =  (head_block_number - 3) & 0xffff;
    let var1 = head_block_number - 2;
    let block_header = await get_block_header(url, var1);
    let ref_block_prefix = new Buffer(block_header.previous, 'hex').readUInt32LE(4)
    const now = new Date().getTime() + 120 * 1000;
    const expiration = new Date(now).toISOString().split('.')[0]

    let ops = [];

    ops.push(["transfer",
    {
        'from'  : account,
        'to'    : golos_acc,
        'amount': amount_str,
        'memo'  : memo
    }]);

    const unsigned_trx = {
        'expiration': expiration,
        'extensions': [],
        'operations': ops,
        'ref_block_num': ref_block_num,
        'ref_block_prefix': ref_block_prefix
    }

    let signed_trx = null;

    signed_trx = golos.auth.signTransaction(unsigned_trx,{"active":wif});

    const { data } = await curly.post(url, {
      postFields: '{"id":1,"method":"call","jsonrpc":"2.0","params":["network_broadcast_api","broadcast_transaction_synchronous",'+
        '[{"ref_block_num":' + ref_block_num + ',"ref_block_prefix":' + ref_block_prefix + ',"expiration":"' + expiration +
        '","operations":[["transfer",{"from":"' + account + '","to":"' + golos_acc + '","amount":"' + amount_str +
        '","memo":"' + memo + '"}]],"extensions":[],"signatures":["' + signed_trx.signatures + '"]} ]]}',
      httpHeader: [
        'Content-Type: application/json',
        'Accept: application/json'
      ],
    });

    let json  = JSON.parse(data);
    return json.result.id;
  }
  catch (error) {
    console.warn("doTransfer: " + error.message);
    return 0;
  }
}

//==============================================================================

async function doDonate(url, wif, account, golos_acc, amount_str, app, comment) {

  try {
    let head_block_number = await get_head_block_num(url);
    let ref_block_num =  (head_block_number - 3) & 0xffff;
    let var1 = head_block_number - 2;
    let block_header = await get_block_header(url, var1);
    let ref_block_prefix = new Buffer(block_header.previous, 'hex').readUInt32LE(4)

    const now = new Date().getTime() + 120 * 1000;
    const expiration = new Date(now).toISOString().split('.')[0]

    let memo = '{"app":"'+ app + '", "version":1, "target": {"author": "' + account + '", "permlink": ""},'+
      '"comment": "' + comment + '" }';
    let donate_memo = JSON.parse(memo);

    let ops = [];
    ops.push(["donate",
    {
        'from'  : account,
        'to'    : golos_acc,
        'amount': amount_str,
        'memo'  : donate_memo
    }]);


    const unsigned_trx = {
        'expiration': expiration,
        'extensions': [],
        'operations': ops,
        'ref_block_num': ref_block_num,
        'ref_block_prefix': ref_block_prefix
    }

    let signed_trx = null;

    signed_trx = golos.auth.signTransaction(unsigned_trx,{"posting":wif});

    const { data } = await curly.post(url, {
      postFields: '{"id":1,"method":"call","jsonrpc":"2.0","params":["network_broadcast_api","broadcast_transaction_synchronous",'+
        '[{"ref_block_num":' + ref_block_num + ',"ref_block_prefix":' + ref_block_prefix + ',"expiration":"' + expiration +
        '","operations":[["donate",{"from":"' + account + '","to":"' + golos_acc + '","amount":"' + amount_str +
        '","memo":'+ memo + '}]],"extensions":[],"signatures":["' + signed_trx.signatures + '"]} ]]}',
      httpHeader: [
        'Content-Type: application/json',
        'Accept: application/json'
      ],
    });

    let json  = JSON.parse(data);
    return json.result.id;
  }
  catch (error) {
    console.warn("doDonate: " + error.message);
    return 0;
  }
}

//==============================================================================

async function getAccount(url, account) {

  try {
    const { data } = await curly.post(url, {
      postFields: '{"id":1,"method":"call","jsonrpc":"2.0","params":["database_api","get_accounts",[["' + account + '"]]]}',
      httpHeader: [
        'Content-Type: application/json',
        'Accept: application/json'
      ],
    });

    let json  = JSON.parse(data);
    return json.result;
  }
  catch (error) {
    console.warn("getAccount: " + error.message);
  }
}


//==============================================================================
async function doAssetIssue(url, wif, account, amount_str, golos_acc ) {

  try {
    let head_block_number = await get_head_block_num(url);
    let ref_block_num =  (head_block_number - 3) & 0xffff;
    let var1 = head_block_number - 2;
    block_header = await get_block_header(url, var1);
    let ref_block_prefix = new Buffer(block_header.previous, 'hex').readUInt32LE(4)

    const now = new Date().getTime() + 120 * 1000;
    const expiration = new Date(now).toISOString().split('.')[0]

    let ops = [];

    ops.push(["asset_issue",
    {
        'creator'  : account,
        'amount'    : amount_str,
        'to'        : golos_acc,
        'extensions': []
    }]);

    const unsigned_trx = {
        'expiration': expiration,
        'extensions': [],
        'operations': ops,
        'ref_block_num': ref_block_num,
        'ref_block_prefix': ref_block_prefix
    }

    let signed_trx = null;

    signed_trx = golos.auth.signTransaction(unsigned_trx,{"active":wif});

    const { data } = await curly.post(url, {
      postFields: '{"id":1,"method":"call","jsonrpc":"2.0","params":["network_broadcast_api","broadcast_transaction_synchronous",' +
        '[{"ref_block_num":' + ref_block_num + ',"ref_block_prefix":' + ref_block_prefix + ',"expiration":"' + expiration + 
        '","operations":[["asset_issue",{"creator":"' + account + '","to":"' + golos_acc + '","amount":"' + amount_str +
        '","extensions":[]}]],"extensions":[],"signatures":["' + signed_trx.signatures + '"]} ]]}',
      httpHeader: [
        'Content-Type: application/json',
        'Accept: application/json'
      ],
    });

    let json  = JSON.parse(data);
    return json.result.id;
  }
  catch (error) {
    console.warn("doAssetIssue: " + error.message);
    return 0;
  }
}

//==============================================================================

async function sendPrivateMsg(url, wif_posting, wif_memo, acc_from, acc_to, msg_str) {

  try {
    let head_block_number = await get_head_block_num(url);
    let ref_block_num =  (head_block_number - 3) & 0xffff;
    let var1 = head_block_number - 2;
    let block_header = await get_block_header(url, var1);
    let ref_block_prefix = new Buffer(block_header.previous, 'hex').readUInt32LE(4)

    const now = new Date().getTime() + 120 * 1000;
    const expiration = new Date(now).toISOString().split('.')[0]

    let acc = await getAccount(url, acc_to);
    let to_memo = acc[0].memo_key;
    acc = await getAccount(url, acc_from);
    let from_memo = acc[0].memo_key;

    let edata = await golos.messages.encodeMsg({ private_memo: wif_memo, to_public_memo: to_memo,
      msg: golos.messages.newTextMsg(msg_str, 'golos-messenger', 1) });

    const ops_json = JSON.stringify(['private_message', {
        from: acc_from,
        to: acc_to,
        nonce: edata.nonce,
        from_memo_key: from_memo,
        to_memo_key: to_memo,
        checksum: edata.checksum,
        update: false,
        encrypted_message: edata.encrypted_message
    }]);

    let json_str = ops_json.replace(/"/g, '\\\"');
    let ops = [];

    ops.push(["custom_json",
    {
        'required_auths'        : [],
        'required_posting_auths': [acc_from],
        'id'                    : "private_message",
        'json'                  : ops_json
    }]);

    const unsigned_trx = {
        'expiration': expiration,
        'extensions': [],
        'operations': ops,
        'ref_block_num': ref_block_num,
        'ref_block_prefix': ref_block_prefix
    }

    let keys = {
        posting: wif_posting
    };

    let signed_trx = null;

    signed_trx = golos.auth.signTransaction(unsigned_trx, keys);

    const { data } = await curly.post(url, {
      postFields: '{"id":1,"method":"call","jsonrpc":"2.0","params":["network_broadcast_api","broadcast_transaction_synchronous",' +
        '[{"ref_block_num":' + ref_block_num + ',"ref_block_prefix":' + ref_block_prefix + ',"expiration":"' + expiration +
        '","operations":[["custom_json",{"required_auths":[],"required_posting_auths":["'+acc_from+'"],"id":"private_message","json":"' +
        json_str + '"}]],"extensions":[],"signatures":["' + signed_trx.signatures + '"]} ]]}',
      httpHeader: [
        'Content-Type: application/json',
        'Accept: application/json'
      ],
    });

    let json  = JSON.parse(data);
    return json.result.id;
  }
  catch (error) {
    console.warn("sendPrivateMsg: " + error.message);
    return 0;
  }
}

//==============================================================================

module.exports = {
    getHistory: getHistory,
    getLiquidBalance: getLiquidBalance,
    doTransfer: doTransfer,
    doDonate: doDonate,
    getAccount: getAccount,
    doAssetIssue: doAssetIssue,
    sendPrivateMsg: sendPrivateMsg
};
