const ApiError = require('../error/apiError');
const bcrypt = require('bcrypt');
const { User, UnconfirmedUser, PasswordRecoveryCode, SearchRegionAndLocation } = require('../models/userModels');
const uuid = require('uuid');
const { makeMailData, transporter } = require('../nodemailer/nodemailer');
const { makeRegistrationConfirmLetter } = require('../nodemailer/registrationConfirmEmail');
const { passwordRecoveryCodeEmail } = require('../nodemailer/passwordRecoveryCodeEmail');
const { Basket } = require('../models/basketModels');
const { getUserResponse } = require('../utils/userFunction');
const { updateModelsField } = require('../utils/functions');

class UserController {
  async registration(req, res, next) {
    try {
      const { email, password, role } = req.body;
      if (!email || !password) {
        return next(ApiError.badRequest('Not valid user password or email'));
      }
      const candidate = await User.findOne({ where: { email } });
      if (candidate) {
        return next(ApiError.badRequest(`User with email ${email} already exist`));
      }
      const hashPassword = await bcrypt.hash(password, 3);
      const user = await User.create({ email, password: hashPassword, role });
      const userId = user.id;
      await Basket.create({ userId });
      await SearchRegionAndLocation.create({ userId });
      const response = await getUserResponse(userId);
      return res.json(response);
    } catch (e) {
      return next(ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError'));
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return next(ApiError.internal('User email or password is not correct'));
      }
      const comparePassword = bcrypt.compareSync(password, user.password);
      if (!comparePassword) {
        return next(ApiError.internal('User email or password is not correct'));
      }
      const response = await getUserResponse(user.id);
      return res.json(response);
    } catch (e) {
      return next(ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError'));
    }
  }

  async getUserByToken(req, res, next) {
    try {
      const userId = req.user.id;
      const user = await User.findOne({ where: { id: userId } });
      if (!user) {
        return next(ApiError.internal('User not found'));
      }
      const response = await getUserResponse(userId);
      return res.json(response);
    } catch (e) {
      return next(ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError'));
    }
  }

  async updateUser(req, res, next) {
    try {
      const userId = req.user.id;
      const user = await User.findOne({ where: { id: userId } });
      if (!user) {
        return next(ApiError.internal('UpdateUser - user not found'));
      }
      const { name, phone, password, searchRegionId, searchLocationId, addressId } = req.body;
      await updateModelsField(user, { name });
      await updateModelsField(user, { phone });
      await updateModelsField(user, { addressId });
      if (password) {
        const hashPassword = await bcrypt.hash(password, 3);
        await user.update({ password: hashPassword });
      }
      if (searchRegionId !== undefined || searchLocationId !== undefined) {
        const searchRegionAndLocation = await SearchRegionAndLocation.findOne({ where: { userId } });
        if (searchRegionAndLocation) {
          await updateModelsField(searchRegionAndLocation, { regionId: searchRegionId });
          await updateModelsField(searchRegionAndLocation, { locationId: searchLocationId });
        } else {
          await SearchRegionAndLocation.create({ userId, regionId: searchRegionId, locationId: searchLocationId });
        }
      }
      const token = req.headers.authorization.split(' ')[1];
      const response = await getUserResponse(user.id, token);
      return res.json(response);
    } catch (e) {
      return next(ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError'));
    }
  }

  async sendConfirmationEmail(req, res, next) {
    try {
      const { email, password } = req.body;
      console.log({ email }, { password });

      if (!email && !password) {
        return next(ApiError.internal('Bad request no user email or password'));
      }
      const userCandidate = await User.findOne({ where: { email } });
      if (userCandidate) {
        return next(ApiError.badRequest(`Пользователь с такой электроной почтой\nуже зарегестрирован на площадке`));
      }
      const unconfirmedUserCandidate = await UnconfirmedUser.findOne({ where: { email } });
      if (unconfirmedUserCandidate) {
        return next(
          ApiError.badRequest(
            `Пользователь данной электроной почтой\nуже прошел предварительную регистрацию.\nЕму на электронную на почту было отправлено письмо\nс инструкцией по активации его личного кабинета`
          )
        );
      }
      const code = uuid.v4().slice(0, 8);
      const time = new Date().toISOString();
      const subject = 'Подтверждение регистрации на lesopilka24.ru';
      const html = makeRegistrationConfirmLetter(code);
      // const mailData = makeMailData({ to: email, subject, html });
      const mailData = makeMailData({ to: 'alexeyk500@yandex.ru', subject, html });
      await transporter.sendMail(mailData, async function (err, info) {
        if (err) {
          return next(ApiError.internal(`Error with sending Confirmation Registration letter, ${err}`));
        } else {
          console.log(`sendMail-${info}`);
        }
        const hashPassword = await bcrypt.hash(password, 3);
        await UnconfirmedUser.create({ email, password: hashPassword, code, time });
        return res.json({ message: `Register confirmation email has been sent to ${email} in ${time}` });
      });
    } catch (e) {
      return next(ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError'));
    }
  }

  async confirmRegistration(req, res, next) {
    try {
      const { code } = req.params;
      if (!code) {
        return next(ApiError.internal('Wrong link from registration email'));
      }
      const candidate = await UnconfirmedUser.findOne({ where: { code } });
      if (!candidate) {
        return next(ApiError.badRequest(`Wrong link from registration email`));
      }
      const email = await candidate.get('email');
      const password = await candidate.get('password');
      await User.create({ email, password });
      await UnconfirmedUser.destroy({ where: { code } });
      return res.redirect(process.env.SUCCESS_REGISTRATION_SITE_PAGE);
    } catch (e) {
      return next(ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError'));
    }
  }

  async sendRecoveryPasswordEmail(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return next(ApiError.internal('Bad request no user email'));
      }
      const candidate = await User.findOne({ where: { email } });
      if (!candidate) {
        return next(ApiError.badRequest(`User with email ${email} do not exist`));
      }
      const code = uuid.v4().slice(0, 6);
      const time = new Date().toISOString();
      const subject = 'Востановление пароля на lesopilka24.ru';
      const html = passwordRecoveryCodeEmail(code);
      const mailData = makeMailData({ to: email, subject, html });
      await transporter.sendMail(mailData, async function (err, info) {
        if (err) {
          return next(ApiError.internal(`Error with sending recovery password letter, ${err}`));
        } else {
          console.log(`sendMail-${info}`);
        }
        await PasswordRecoveryCode.destroy({ where: { email } });
        await PasswordRecoveryCode.create({ email, code, time });
        return res.json({ message: `Letter with password recovery code has been sent to ${email} in ${time}` });
      });
    } catch (e) {
      return next(ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError'));
    }
  }

  async deleteTestUser(req, res, next) {
    try {
      const { email, isUnconfirmed } = req.body;
      console.log(`testUserDelete email=`, email, isUnconfirmed);
      if (!email) {
        return next(ApiError.internal('Bad request no test user email'));
      }
      const testKey = email.split('-')[0];
      console.log({ testKey });
      if (testKey !== 'test') {
        return next(ApiError.internal('Bad request no testKey in user email'));
      }
      if (isUnconfirmed) {
        const unconfirmedUserCandidate = await UnconfirmedUser.findOne({ where: { email } });
        if (!unconfirmedUserCandidate) {
          return next(ApiError.badRequest(`unconfirmedUser with email ${email} do not exist`));
        }
        await UnconfirmedUser.destroy({ where: { email } });
        return res.json({ message: `testUnconfirmedUser - deleted` });
      } else {
        const userCandidate = await User.findOne({ where: { email } });
        if (!userCandidate) {
          return next(ApiError.badRequest(`user with email ${email} do not exist`));
        }
        await User.destroy({ where: { email } });
        return res.json({ message: `testUser - deleted` });
      }
    } catch (e) {
      return next(ApiError.badRequest(e?.original?.detail ? e.original.detail : 'deleteTestUser - unknownError'));
    }
  }

  async confirmRecoveryPasswordCode(req, res, next) {
    try {
      const { code, password } = req.body;
      if (!code && !password) {
        return next(ApiError.internal('Wrong code or password from recovery password email'));
      }
      const candidate = await PasswordRecoveryCode.findOne({ where: { code } });
      if (!candidate) {
        return next(ApiError.badRequest(`This recovery code does not exist`));
      }
      const email = await candidate.get('email');
      const hashPassword = await bcrypt.hash(password, 3);
      await User.update({ password: hashPassword }, { where: { email } });
      await PasswordRecoveryCode.destroy({ where: { code } });
      return res.json({ message: `Пароль для пользователя ${email}\n был успешно сменен` });
    } catch (e) {
      return next(ApiError.badRequest(e?.original?.detail ? e.original.detail : 'unknownError'));
    }
  }
}

module.exports = new UserController();
