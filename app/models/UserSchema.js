'use strict';

const mongoClient = require('mongoose');
const to = require('await-to-js').default;

const UserSchema = new mongoClient.Schema({
   uid: {
      type: String,
       required: true,
       unique: true
   },
   name: {
      type: String,
      required: true
   },
   password: {
      type: String,
      required: true
   },
   createOn: Date
});

// 회원가입 메서드
UserSchema.statics.register = function(userData) {
   return new Promise(async function (resolve, reject) {
      let [errCreate, userDoc] = await to(this.create(userData));
      if(errCreate) {
        errCreate.message = "회원가입을 실패하였습니다."; reject(errCreate);
      }

      resolve(userDoc);
   }.bind(this))
};

module.exports = mongoClient.model('user', UserSchema);