'use strict';

/**
 * Maps PHIN Provider names to competitive groups.
 * Only IND (independent) sector sites are relevant for private market share.
 */

const GROUP_MAP = {
  'Nuffield Health': 'Nuffield',
  'Spire Healthcare': 'Spire',
  'Circle Health Group': 'Circle',
  'Ramsay Health Care UK': 'Ramsay',
};

function mapProviderToGroup(providerName) {
  return GROUP_MAP[providerName] || 'Other';
}

module.exports = { mapProviderToGroup, GROUP_MAP };
