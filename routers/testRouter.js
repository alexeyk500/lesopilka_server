const Router = require('express');
const testController = require('../controllers/testController');
const testRouter = new Router();

testRouter.post('/delete-test-user', testController.deleteTestUser);
testRouter.post('/delete-test-user-address', testController.deleteTestUserAddress);
testRouter.post('/delete-test-user-basket', testController.deleteTestUserBasket);
testRouter.post('/delete-test-user-search-region-and-location', testController.deleteTestUserSearchRegionAndLocation);
testRouter.post('/delete-test-user-manufacturer', testController.deleteTestUserManufacturer);
testRouter.post('/delete-test-user-manufacturer-address', testController.deleteTestUserManufacturerAddress);
testRouter.post('/delete-test-user-reseller', testController.deleteTestUserReseller);
testRouter.post('/delete-test-user-reseller-address', testController.deleteTestUserResellerAddress);

module.exports = testRouter;