const sequelize = require('../db');
const { DataTypes } = require('sequelize');
const { Address, PickUpAddress } = require('./addressModels');
const { User } = require('./userModels');

const Manufacturer = sequelize.define(
  'manufacturer',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    inn: { type: DataTypes.STRING, unique: true },
    title: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING, unique: true },
    phone: { type: DataTypes.STRING, unique: true },
    approved: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { timestamps: false }
);

User.hasOne(Manufacturer);
Manufacturer.belongsTo(User);

Address.hasOne(Manufacturer);
Manufacturer.belongsTo(Address);

Manufacturer.hasOne(PickUpAddress);
PickUpAddress.belongsTo(Manufacturer);

module.exports = {
  Manufacturer,
};
