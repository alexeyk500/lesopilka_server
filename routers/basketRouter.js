const Router = require('express');
const basketController = require('../controllers/basketController');
const authMiddleware = require('../middleware/authMiddleware');
const basketRouter = new Router();

basketRouter.post('/', authMiddleware, basketController.toggleProductForBasket);
basketRouter.get('/', authMiddleware, basketController.getBasketProducts);
basketRouter.put('/', authMiddleware, basketController.setBasketProductsAmount);

module.exports = basketRouter;
