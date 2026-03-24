const mock = require('./config/mpesa-mock');

(async () => {
  console.log('keys', Object.keys(mock));
  const res = await mock.initiateSTKPush('0712345678', 100, 'order1');
  console.log('init res', res);
  const id = res.checkoutRequestId;
  console.log('first query', await mock.queryTransactionStatus(id));
  console.log('second query', await mock.queryTransactionStatus(id));
  console.log('third query', await mock.queryTransactionStatus(id));
})();
