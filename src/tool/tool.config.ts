import type { ToolConfig } from '@itsjust/core';

export const toolConfig: ToolConfig = {
  id: 'mac-address-formatter',
  name: 'MAC Address Formatter',
  description: 'Format, convert, and analyze MAC addresses across notation styles and vendors.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: false,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
};

export default toolConfig;
