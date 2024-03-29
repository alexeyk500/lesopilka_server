const ApiError = require('../error/apiError');
const { OrderMessage } = require('../models/orderMessageModels');
const { Order } = require('../models/orderModels');
const { getManufacturerIdForUser } = require('../utils/functions');
const {
  checkIsValueBoolean,
  checkIsValuePositiveNumber,
  checkIsUserOwnerForOrder,
  checkIsUserManufacturerForOrder,
} = require('../utils/checkFunctions');
const { MessageFromToOptions } = require('../utils/constants');
const { sendNewMessageForOrder, createOrderMessage } = require('../utils/ordersFunctions');

class OrderMessageController {
  async createNewOrderMessage(req, res, next) {
    try {
      const userId = req.user.id;
      const { orderId, isManufacturerMessage, messageText } = req.body;
      if (!orderId || !messageText || !checkIsValueBoolean(isManufacturerMessage)) {
        return next(ApiError.badRequest('createNewOrderMessage - request denied 1'));
      }
      if (!checkIsValuePositiveNumber(orderId)) {
        return next(ApiError.badRequest('createNewOrderMessage - request denied 2'));
      }
      const order = await Order.findOne({ where: { id: orderId } });
      if (!order) {
        return next(ApiError.badRequest(`createNewOrderMessage - request denied 3`));
      }
      let newOrderMessage;
      const newDate = new Date();
      const messageDate = newDate.toISOString();
      if (isManufacturerMessage) {
        const isLegalManufacturer = await checkIsUserManufacturerForOrder(userId, orderId);
        if (!isLegalManufacturer) {
          return next(ApiError.badRequest(`createNewOrderMessage - request denied 4`));
        }
        const manufacturerId = await getManufacturerIdForUser(userId);
        newOrderMessage = await createOrderMessage({ orderId, manufacturerId, messageDate, messageText, next });
      } else {
        const isLegalUser = checkIsUserOwnerForOrder(userId, order);
        if (!isLegalUser) {
          return next(ApiError.badRequest(`createNewOrderMessage - request denied 6`));
        }
        newOrderMessage = await createOrderMessage({ orderId, userId, messageDate, messageText, next });
      }

      await sendNewMessageForOrder({
        orderId,
        messageFromTo: isManufacturerMessage
          ? MessageFromToOptions.ManufacturerToUser
          : MessageFromToOptions.UserToManufacturer,
        messageText,
        next,
      });

      return res.json({ message: newOrderMessage });
    } catch (e) {
      return next(ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError'));
    }
  }

  async getOrderMessages(req, res, next) {
    try {
      const userId = req.user.id;
      const { orderId } = req.params;
      if (!checkIsValuePositiveNumber(orderId)) {
        return next(ApiError.badRequest('getOrderMessages - request denied 1'));
      }
      const order = await Order.findOne({ where: { id: orderId } });
      if (!order) {
        return next(ApiError.badRequest(`getOrderMessages - request denied 2`));
      }
      const isUserOwnerForOrder = checkIsUserOwnerForOrder(userId, order);
      if (!isUserOwnerForOrder) {
        const isUserManufacturerForOrder = await checkIsUserManufacturerForOrder(userId, orderId);
        if (!isUserManufacturerForOrder) {
          return next(ApiError.badRequest(`getOrderMessages - request denied 3`));
        }
      }
      const messages = await OrderMessage.findAll({ where: { orderId }, order: ['messageDate'] });
      return res.json(messages);
    } catch (e) {
      return next(ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError'));
    }
  }
}

module.exports = new OrderMessageController();
