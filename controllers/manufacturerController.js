const ApiError = require('../error/apiError');
const {Address} = require("../models/addressModels");
const {Manufacturer} = require("../models/manufacturerModels");

class ManufacturerController {
  async createManufacturer(req, res, next) {
    try {
      const userId = req.user.id;
      const {title, inn, locationId, street, building, office} = req.body;
      if (!userId || !title || !inn || !locationId || !street || !building) {
        return next(ApiError.badRequest('createManufacturer - request data is not complete'));
      }
      const candidateUserId = await Manufacturer.findOne({where: {userId}});
      if (candidateUserId) {
        return next(ApiError.badRequest(`Manufacturer for userId=${userId} already has been registered`));
      }
      const candidateWithInn = await Manufacturer.findOne({where: {inn}});
      if (candidateWithInn) {
        return next(ApiError.badRequest(`Manufacturer with inn=${inn} already has been registered`));
      }
      const address = await Address.create({locationId, street, building, office})
      const manufacturer = await Manufacturer.create({title, inn, addressId: address.id, userId});
      return res.json(manufacturer);
    } catch (e) {
      return next(ApiError.badRequest(e.original.detail));
    }
  }
}

module.exports = new ManufacturerController();
