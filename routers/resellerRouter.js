const Router = require('express');
const resellerController = require('../controllers/resellerController');
const authMiddleware = require('../middleware/authMiddleware');
const resellerRouter = new Router();

resellerRouter.post('/', authMiddleware, resellerController.createReseller);
resellerRouter.post('/manufacturer-candidate', authMiddleware, resellerController.manufacturerCandidate);

module.exports = resellerRouter;