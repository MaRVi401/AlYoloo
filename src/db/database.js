import Dexie from 'dexie';

export const db = new Dexie('DocScannerDB');
db.version(1).stores({
  scans: '++id, imageBlob, timestamp'
});