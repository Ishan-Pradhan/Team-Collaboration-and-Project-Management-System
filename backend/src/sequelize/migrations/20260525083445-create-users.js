'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
   await queryInterface.createTable("Users",{
    id:{
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    name:{
      type: Sequelize.STRING,
      allowNull: false,
    },
    email:{
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,   
    },
      password:{
        type: Sequelize.STRING,
        allowNull: false,
      },
      role:{
        type: Sequelize.ENUM("user", "admin"),
        defaultValue: "user",
      },
      isVerified:{
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
   }, 
   {
    timestamps: true,
   })
  },

  async down (queryInterface, Sequelize) {
      await queryInterface.dropTable('users');
  }
};
