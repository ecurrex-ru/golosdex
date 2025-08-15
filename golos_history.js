// подключаем необходимые библиотеки
const config = require('config');
const lockFile = require('lockfile');
const golite = require('golos_lite');
const mariadb = require('mariadb');
const golos = require('golos-lib-js');

// путь для lock  файла
const path = '/home/igor/gates/golos_history.lock';
const opts = {};

// параметры для истории голосового аккаунта
const from = config.get('gates.golos.history.from');
const limit = config.get('gates.golos.history.limit');

// адрес API ноды Golos
const host = config.get('gates.golos.node_url');

// основной аккаунт на Golos
const main_account = config.get('gates.golos.main_account');

async function main() {

  // проверяем на предыдущий lock
  let isLocked = lockFile.checkSync(path, [opts]);

  // если прошлого лока нет
  if (!isLocked) {
    // создаем текущий lock файл
    lockFile.lockSync(path, [opts]);
    console.log('locked!');

    let balance = await golite.getLiquidBalance(host, main_account);
    // если нода ответила
    if (balance != undefined) {
      // получаем список аккаунтов для шлюзов
      let accounts = await getAccounts();

      // проверяем все аккаунты шлюзов на Голосе
      let i = 0;
      while (accounts[i] != undefined)
      {
        // получаем историю по аккаунту
        let history = await golite.getHistory(host, accounts[i].account, from, limit);
        // обрабатываем историю
        await processHistory(history, accounts[i]);
        i++;
      }
    }
    else { console.warn('node is down!'); }
    console.log('unlocked!');
    lockFile.unlockSync(path);
  }
}

async function getAccounts() {

  let conn;

  try {
    // получаем параметры для базы данных
    const dbconfig = config.get('gates.dbconfig');
    // создаем соединение с базой
    conn = await mariadb.createConnection(dbconfig);

    // получаем список всех технических аккаунтов рабочих шлюзов
    const rows = await conn.query('select * from golos_accounts');
    return (rows);
  } finally {
    if (conn) conn.end();
  }
}

async function processHistory(history, account) {

  let i = 0;
  let conn;

  // получаем последний обработанный блок
  let height = account.height;

  try {
    // получаем параметры для базы данных
    const dbconfig = config.get('gates.dbconfig');
    // создаем соединение с базой
    conn = await mariadb.createConnection(dbconfig);

    // получаем приватный ключ заметок (memo)
    const wif_memo = golos.auth.toWif(account.account, account.password, 'memo');

    // начинаем транзакцию
    await conn.beginTransaction();

    try {
      while (history[i] != undefined) {

        let op = history[i][1].op[0];

        if (op == 'transfer' || op == 'donate') {

          let block = history[i][1].block;
          let trx_id = history[i][1].trx_id;
          let acc_from = history[i][1].op[1].from;

          let acc_to = history[i][1].op[1].to;
          let amount = history[i][1].op[1].amount;

          let amount_array = amount.split(" ");
          let summa = amount_array[0];
          let token = amount_array[1];
          let memo = '';

          // расшифровываем примечание при необходимости
          await golos.importNativeLib();
          try {
            memo = golos.memo.decode(wif_memo, history[i][1].op[1].memo);
          }
          catch(err) {
            memo = '';
          }

          if (memo[0] == '#') {
            var x =  memo.replace(/^\#/, '');
            memo = x;
          }
          let out_address = '';
          if (memo != '' && memo != 'deposit') {
            out_address = memo.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
          }

          let memo_array = out_address.split(":");
          let type = 'local';
          let wallet = out_address;
          let note = '';

          if (memo_array[0] == 'wallet' || memo_array[0] == 'exchange' || memo_array[0] == 'tonwallet') {
            type = memo_array[0];
            wallet = memo_array[1];
            note = memo_array[2];
          }

          // если нашли более новый блок, сохраняем историю в базе
          if (block > account.height) {
            if (op == account.op_type && acc_from != account.account && token == account.token) {
              let rows = await conn.query("select count(*) as 'count' from golos_history where trx_id = ?", [trx_id]);
              console.log(rows[0].count);
              if (rows[0].count == 0) {
                console.log('insert new record');
                await conn.query('insert into golos_history (account, height, trx_id, acc_from, amount, type, wallet, note) ' +
                  'values (?, ?, ?, ?, ?, ?, ?, ?)', [account.account, block, trx_id, acc_from, amount, type, wallet, note]);
              }
            }
          }
          height = block;
        }
        i++;
      }
      // если получили блок новее, обновляем его в таблице
      if (height > account.height) {
        await conn.query('update golos_accounts set height = ? where account = ?', [height, account.account]);
      }
      // сохраняем все изменения в базе
      await conn.commit();
    } catch (err) {
        console.error("Error inserting history / update height: ", err);
        // откатываем все изменения в базе
        await conn.rollback();
    }
  } catch (err) {
      console.error("Error starting a transaction: ", err);
  }
  finally {
    // закрываем соединение с базой
    if (conn) conn.end();
  }
}

main();
