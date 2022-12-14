const sequelize = require('../db');
const { DataTypes } = require('sequelize');

const Region = sequelize.define(
  'region',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, unique: true, allowNull: false },
  },
  { timestamps: false }
);

const Location = sequelize.define(
  'location',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, unique: true, allowNull: false },
  },
  { timestamps: false }
);

const Address = sequelize.define(
  'address',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    street: { type: DataTypes.STRING, allowNull: false },
    building: { type: DataTypes.STRING, allowNull: false },
    office: { type: DataTypes.STRING },
    postIndex: { type: DataTypes.STRING },
  },
  { timestamps: false }
);

const ManufacturerPickUpAddress = sequelize.define(
  'pickUpAddress',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    street: { type: DataTypes.STRING, allowNull: false },
    building: { type: DataTypes.STRING, allowNull: false },
    office: { type: DataTypes.STRING },
    postIndex: { type: DataTypes.STRING },
  },
  { timestamps: false }
);

Region.hasMany(Location);
Location.belongsTo(Region);

Location.hasMany(Address);
Address.belongsTo(Location);

Location.hasMany(ManufacturerPickUpAddress);
ManufacturerPickUpAddress.belongsTo(Location);

module.exports = {
  Region,
  Location,
  Address,
  ManufacturerPickUpAddress,
};
