-- Records Table
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT CHECK(type IN ('lend', 'borrow', 'repay')) NOT NULL,
  contactName TEXT NOT NULL,
  notes TEXT,
  date TEXT,
  dueDate TEXT,
  photoUrl TEXT,
  repayDirection TEXT CHECK(repayDirection IN ('someone_to_me', 'me_to_someone', NULL)),
  status TEXT CHECK(status IN ('pending', 'completed')) DEFAULT 'pending',
  repaidAmount REAL DEFAULT 0,
  relatedRecordId INTEGER,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_records_uid_status ON records(uid, status);
CREATE INDEX IF NOT EXISTS idx_records_uid_contact ON records(uid, contactName);

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  uid TEXT NOT NULL,
  name TEXT NOT NULL,
  totalLent REAL DEFAULT 0,
  totalBorrowed REAL DEFAULT 0,
  countTimes INTEGER DEFAULT 0,
  countDefaults INTEGER DEFAULT 0,
  lastUpdate TEXT DEFAULT (datetime('now', 'localtime')),
  PRIMARY KEY (uid, name)
);
