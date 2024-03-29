const ApiError = require('../error/apiError');
const { checkIsValuePositiveNumber, checkIsDateStrIsValidDate, checkIsValueExist } = require('../utils/checkFunctions');
const { LicensePrice, ReceiptTransaction, LicenseAction } = require('../models/licenseModels');
const {
  doJobForManufacturers,
  redeemLicenseByManufacturerId,
  depublishProductsByManufacturerId,
  informLicensesRunOutByManufacturerId,
  getProductCardsAmountsByManufacturerId,
} = require('../jobs/licenseJob');
const { Manufacturer } = require('../models/manufacturerModels');
const { getManufacturerIdForUser, normalizeData, dateDayShift } = require('../utils/functions');
const { Op } = require('sequelize');

class LicenseController {
  async licensePurchase(req, res, next) {
    try {
      const { manufacturerId, receiptSum } = req.body;
      if (!checkIsValuePositiveNumber(manufacturerId) || !checkIsValuePositiveNumber(receiptSum)) {
        return next(ApiError.badRequest('licensePurchase - request denied 1'));
      }

      const manufacturerCandidate = await Manufacturer.findOne({ where: { id: manufacturerId } });
      if (!manufacturerCandidate) {
        return next(ApiError.badRequest('licensePurchase - request denied 2'));
      }

      const lastLicensePrice = await LicensePrice.findOne({ order: [['priceDate', 'DESC']] });
      const licensePrice = lastLicensePrice.licensePrice;
      if (!licensePrice) {
        return next(ApiError.badRequest('licensePurchase - request denied 3'));
      }

      const licenseAmount = Math.round(receiptSum / licensePrice);
      if (licenseAmount <= 0) {
        return next(ApiError.badRequest('licensePurchase - request denied 4'));
      }

      const newDate = new Date();
      const receiptDate = newDate.toISOString();

      const newReceiptTransaction = await ReceiptTransaction.create({
        receiptDate,
        receiptSum,
        licenseAmount,
        licensePrice,
        manufacturerId,
      });
      if (!newReceiptTransaction) {
        return next(ApiError.badRequest('licensePurchase - request denied 5'));
      }

      const lastLicenseAction = await LicenseAction.findOne({
        where: { manufacturerId },
        order: [['actionDate', 'DESC']],
      });
      let restLicenseAmount;
      if (checkIsValueExist(lastLicenseAction)) {
        restLicenseAmount = lastLicenseAction.restLicenseAmount + licenseAmount;
      } else {
        restLicenseAmount = licenseAmount;
      }

      const { activeProductCardAmount, draftProductCardAmount } = await getProductCardsAmountsByManufacturerId(
        manufacturerId
      );

      const newLicenseAction = await LicenseAction.create({
        actionDate: receiptDate,
        restLicenseAmount,
        purchaseLicenseAmount: licenseAmount,
        activeProductCardAmount,
        draftProductCardAmount,
        manufacturerId,
        receiptTransactionId: newReceiptTransaction.id,
      });
      if (!newLicenseAction) {
        return next(ApiError.badRequest('licensePurchase - request denied 6'));
      }

      return res.json({ message: newLicenseAction });
    } catch (e) {
      return next(ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError: licensePurchase'));
    }
  }

  async getManufacturerLicenseActions(req, res, next) {
    try {
      const userId = req.user.id;
      const { dateFrom, dateTo } = req.body;
      if (!userId || !checkIsDateStrIsValidDate(dateFrom) || !checkIsDateStrIsValidDate(dateTo)) {
        return next(ApiError.badRequest('getManufacturerLicenseActions - request denied 1'));
      }
      const manufacturerId = await getManufacturerIdForUser(userId);
      if (!manufacturerId) {
        return next(ApiError.badRequest('getManufacturerLicenseActions - request denied 2'));
      }

      let searchParams = {};
      searchParams.manufacturerId = manufacturerId;
      const normDateFrom = normalizeData(dateFrom);
      const normDateTo = normalizeData(dateDayShift(dateTo, 1));
      searchParams.actionDate = {
        [Op.and]: {
          [Op.gte]: normDateFrom,
          [Op.lte]: normDateTo,
        },
      };

      const licenseActions = await LicenseAction.findAll({
        where: searchParams,
        attributes: { exclude: ['manufacturerId'] },
        order: ['actionDate'],
      });

      return res.json(licenseActions);
    } catch (e) {
      return next(
        ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError: getManufacturerLicenseActions')
      );
    }
  }

  async getManufacturerLicenseInfo(req, res, next) {
    try {
      const userId = req.user.id;
      if (!userId) {
        return next(ApiError.badRequest('getManufacturerLicenseInfo - request denied 1'));
      }
      const manufacturerId = await getManufacturerIdForUser(userId);
      if (!manufacturerId) {
        return next(ApiError.badRequest('getCurrentManufacturerLicenseInfo - request denied 2'));
      }

      const lastLicenseAction = await LicenseAction.findOne({
        where: { manufacturerId },
        order: [['actionDate', 'DESC']],
      });
      let restLicenseAmount;
      if (checkIsValueExist(lastLicenseAction)) {
        restLicenseAmount = lastLicenseAction.restLicenseAmount;
      } else {
        restLicenseAmount = 0;
      }
      const { activeProductCardAmount } = await getProductCardsAmountsByManufacturerId(manufacturerId);

      return res.json({ activeProductCardAmount, restLicenseAmount });
    } catch (e) {
      return next(
        ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError: getManufacturerLicenseInfo')
      );
    }
  }

  async manufacturerDepublishJobStart(req, res, next) {
    try {
      const { manufacturerId } = req.body;
      if (!checkIsValuePositiveNumber(manufacturerId)) {
        return next(
          ApiError.badRequest(`manufacturerDepublishJobStart - error with manufacturerId: ${manufacturerId}`)
        );
      }
      await depublishProductsByManufacturerId(manufacturerId);
      return res.json({ message: `success manufacturerDepublishJobStart : ${manufacturerId}` });
    } catch (e) {
      return next(
        ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError: manufacturerDepublishJobStart')
      );
    }
  }
  async manufacturerRedeemJobStart(req, res, next) {
    try {
      const { manufacturerId } = req.body;
      if (!checkIsValuePositiveNumber(manufacturerId)) {
        return next(ApiError.badRequest(`manufacturerRedeemJobStart - error with manufacturerId: ${manufacturerId}`));
      }
      await redeemLicenseByManufacturerId(manufacturerId);
      return res.json({ message: `success manufacturerRedeemJobStart : ${manufacturerId}` });
    } catch (e) {
      return next(
        ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError: manufacturerRedeemJobStart')
      );
    }
  }
  async manufacturerInformLicensesRunOutJobStart(req, res, next) {
    try {
      const { manufacturerId } = req.body;
      if (!checkIsValuePositiveNumber(manufacturerId)) {
        return next(
          ApiError.badRequest(`manufacturerInformLicensesRunOutJobStart - error with manufacturerId: ${manufacturerId}`)
        );
      }
      await informLicensesRunOutByManufacturerId(manufacturerId);
      return res.json({ message: `success manufacturerInformLicensesRunOutJobStart : ${manufacturerId}` });
    } catch (e) {
      return next(
        ApiError.badRequest(
          e?.original?.detail ? e.original.detail : 'unknownError: manufacturerInformLicensesRunOutJobStart'
        )
      );
    }
  }

  async nightDepublishProductsJobStart(req, res, next) {
    try {
      const { testId } = req.body;
      if (!checkIsValuePositiveNumber(testId)) {
        return next(ApiError.badRequest(`nightDepublishProductsJobStart - error with testId: ${testId}`));
      }
      await doJobForManufacturers(depublishProductsByManufacturerId);
      return res.json({ message: `success nightDepublishProductsJobStart : ${testId}` });
    } catch (e) {
      return next(
        ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError: nightDepublishProductsJobStart')
      );
    }
  }
  async nightRedeemLicenseJobStart(req, res, next) {
    try {
      const { testId } = req.body;
      if (!checkIsValuePositiveNumber(testId)) {
        return next(ApiError.badRequest(`nightRedeemLicenseJobStart - error with testId: ${testId}`));
      }
      await doJobForManufacturers(redeemLicenseByManufacturerId);
      return res.json({ message: `success nightRedeemLicenseJobStart : ${testId}` });
    } catch (e) {
      return next(
        ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError: nightRedeemLicenseJobStart')
      );
    }
  }
  async nightInformLicensesRunOutJobStart(req, res, next) {
    try {
      const { testId } = req.body;
      if (!checkIsValuePositiveNumber(testId)) {
        return next(ApiError.badRequest(`nightInformLicensesRunOutJobStart - error with testId: ${testId}`));
      }
      await doJobForManufacturers(informLicensesRunOutByManufacturerId);
      return res.json({ message: `success nightInformLicensesRunOutJobStart : ${testId}` });
    } catch (e) {
      return next(
        ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError: nightInformLicensesRunOutJobStart')
      );
    }
  }
}

module.exports = new LicenseController();
