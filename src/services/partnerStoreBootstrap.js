const { sequelize } = require('../database/connection');
const PartnerStore = require('../models/PartnerStore');

const ensurePartnerStoreSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const table = await queryInterface.describeTable('partner_stores');

    if (!table.contactEmail) {
      await queryInterface.addColumn('partner_stores', 'contactEmail', {
        type: PartnerStore.rawAttributes.contactEmail.type,
        allowNull: true
      });
    }
    if (!table.legalName) {
      await queryInterface.addColumn('partner_stores', 'legalName', {
        type: PartnerStore.rawAttributes.legalName.type,
        allowNull: true
      });
    }
    if (!table.primaryLink) {
      await queryInterface.addColumn('partner_stores', 'primaryLink', {
        type: PartnerStore.rawAttributes.primaryLink.type,
        allowNull: true
      });
    }
    if (!table.operatingTime) {
      await queryInterface.addColumn('partner_stores', 'operatingTime', {
        type: PartnerStore.rawAttributes.operatingTime.type,
        allowNull: true
      });
    }
    if (!table.salesPlatforms) {
      await queryInterface.addColumn('partner_stores', 'salesPlatforms', {
        type: PartnerStore.rawAttributes.salesPlatforms.type,
        allowNull: true
      });
    }
    if (!table.physicalAddress) {
      await queryInterface.addColumn('partner_stores', 'physicalAddress', {
        type: PartnerStore.rawAttributes.physicalAddress.type,
        allowNull: true
      });
    }
    if (!table.focusOnePiece) {
      await queryInterface.addColumn('partner_stores', 'focusOnePiece', {
        type: PartnerStore.rawAttributes.focusOnePiece.type,
        allowNull: true,
        defaultValue: false
      });
    }
    if (!table.eventsHosted) {
      await queryInterface.addColumn('partner_stores', 'eventsHosted', {
        type: PartnerStore.rawAttributes.eventsHosted.type,
        allowNull: true,
        defaultValue: false
      });
    }
    if (!table.eventsDetails) {
      await queryInterface.addColumn('partner_stores', 'eventsDetails', {
        type: PartnerStore.rawAttributes.eventsDetails.type,
        allowNull: true
      });
    }
    if (!table.bannerUrl) {
      await queryInterface.addColumn('partner_stores', 'bannerUrl', {
        type: PartnerStore.rawAttributes.bannerUrl.type,
        allowNull: true
      });
    }
  } catch (error) {
    if (error && error.name === 'SequelizeDatabaseError' && /does not exist/i.test(error.message)) {
      await PartnerStore.sync();
      return;
    }

    throw error;
  }
};

module.exports = {
  ensurePartnerStoreSchema
};
