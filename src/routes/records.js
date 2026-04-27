import { Hono } from 'hono';

const records = new Hono();

records.get('/', async (c) => {
  const user = c.get('jwtPayload');
  const uid = user.openid;
  const { contactName, type, status } = c.req.query();

  try {
    // 将 id 别名为 _id 以兼容前端
    let sql = 'SELECT id as _id, * FROM records WHERE uid = ?';
    let params = [uid];

    if (contactName) {
      sql += ' AND contactName = ?';
      params.push(contactName);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY date DESC LIMIT 100';

    const { results } = await c.env.DB.prepare(sql).bind(...params).all();
    return c.json({ success: true, data: results });
  } catch (err) {
    console.error('getRecords Error:', err);
    return c.json({ success: false, error: err.message }, 400);
  }
});

records.get('/:id', async (c) => {
  const user = c.get('jwtPayload');
  const uid = user.openid;
  const id = c.req.param('id');

  try {
    const record = await c.env.DB.prepare('SELECT id as _id, * FROM records WHERE id = ? AND uid = ?').bind(id, uid).first();
    if (!record) return c.json({ success: false, error: 'Record not found' }, 404);
    return c.json({ success: true, data: record });
  } catch (err) {
    console.error('getRecordById Error:', err);
    return c.json({ success: false, error: err.message }, 400);
  }
});

records.post('/', async (c) => {
  const user = c.get('jwtPayload');
  const uid = user.openid;
  const { amount, type, contactName, repayDirection, notes, date, dueDate, photoUrl, relatedRecordId } = await c.req.json();

  if (typeof amount !== 'number' || amount <= 0) {
    return c.json({ success: false, error: '金额必须是大于 0 的数字' }, 400);
  }
  if (!contactName) {
    return c.json({ success: false, error: '联系人姓名不能为空' }, 400);
  }

  try {
    const batchQueries = [];
    
    // 1. 插入新记录
    batchQueries.push(
      c.env.DB.prepare(`
        INSERT INTO records (uid, amount, type, contactName, notes, date, dueDate, photoUrl, repayDirection, relatedRecordId, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        uid, amount, type, contactName, notes, date, dueDate, photoUrl, 
        type === 'repay' ? repayDirection : null,
        (type === 'repay' && relatedRecordId) ? relatedRecordId : null,
        'pending'
      )
    );

    // 2. 如果是“还款”，更新原欠单状态
    if (type === 'repay' && relatedRecordId) {
      const originalRecord = await c.env.DB.prepare('SELECT * FROM records WHERE id = ? AND uid = ?').bind(relatedRecordId, uid).first();
      if (originalRecord) {
        const totalRepaid = (originalRecord.repaidAmount || 0) + amount;
        if (totalRepaid > originalRecord.amount + 0.001) {
          return c.json({ success: false, error: '还款金额不能超过未结清金额' }, 400);
        }
        const newStatus = totalRepaid >= originalRecord.amount ? 'completed' : 'pending';
        batchQueries.push(
          c.env.DB.prepare('UPDATE records SET repaidAmount = repaidAmount + ?, status = ?, updatedAt = datetime("now", "localtime") WHERE id = ? AND uid = ?')
            .bind(amount, newStatus, relatedRecordId, uid)
        );
      }
    }

    // 3. 更新联系人余额
    const contact = await c.env.DB.prepare('SELECT * FROM contacts WHERE uid = ? AND name = ?').bind(uid, contactName).first();
    if (!contact) {
      batchQueries.push(
        c.env.DB.prepare('INSERT INTO contacts (uid, name, totalLent, totalBorrowed, countTimes) VALUES (?, ?, ?, ?, 1)')
          .bind(uid, contactName, type === 'lend' ? amount : 0, type === 'borrow' ? amount : 0)
      );
    } else {
      let totalLentInc = 0;
      let totalBorrowedInc = 0;
      if (type === 'lend') totalLentInc = amount;
      if (type === 'borrow') totalBorrowedInc = amount;
      if (type === 'repay') {
        if (repayDirection === 'someone_to_me') totalLentInc = -amount;
        else totalBorrowedInc = -amount;
      }
      batchQueries.push(
        c.env.DB.prepare('UPDATE contacts SET totalLent = totalLent + ?, totalBorrowed = totalBorrowed + ?, countTimes = countTimes + 1, lastUpdate = datetime("now", "localtime") WHERE uid = ? AND name = ?')
          .bind(totalLentInc, totalBorrowedInc, uid, contactName)
      );
    }

    await c.env.DB.batch(batchQueries);
    return c.json({ success: true });
  } catch (err) {
    console.error('saveRecord Error:', err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

records.delete('/:id', async (c) => {
  const user = c.get('jwtPayload');
  const uid = user.openid;
  const id = c.req.param('id');

  try {
    const record = await c.env.DB.prepare('SELECT * FROM records WHERE id = ? AND uid = ?').bind(id, uid).first();
    if (!record) return c.json({ success: false, error: 'Record not found' }, 404);

    const batchQueries = [];
    
    // 1. 删除记录
    batchQueries.push(c.env.DB.prepare('DELETE FROM records WHERE id = ? AND uid = ?').bind(id, uid));

    // 2. 冲抵余额和还原状态
    let totalLentInc = 0;
    let totalBorrowedInc = 0;
    if (record.type === 'lend' && record.status === 'pending') totalLentInc = -record.amount;
    if (record.type === 'borrow' && record.status === 'pending') totalBorrowedInc = -record.amount;

    if (record.type === 'repay') {
      if (record.repayDirection === 'someone_to_me') totalLentInc = record.amount;
      else totalBorrowedInc = record.amount;

      if (record.relatedRecordId) {
        const originalRecord = await c.env.DB.prepare('SELECT * FROM records WHERE id = ? AND uid = ?').bind(record.relatedRecordId, uid).first();
        if (originalRecord) {
          const newRepaidAmount = Math.max(0, (originalRecord.repaidAmount || 0) - record.amount);
          const newStatus = newRepaidAmount < originalRecord.amount ? 'pending' : 'completed';
          batchQueries.push(
            c.env.DB.prepare('UPDATE records SET repaidAmount = ?, status = ?, updatedAt = datetime("now", "localtime") WHERE id = ? AND uid = ?')
              .bind(newRepaidAmount, newStatus, record.relatedRecordId, uid)
          );
        }
      }
    }

    batchQueries.push(
      c.env.DB.prepare('UPDATE contacts SET totalLent = totalLent + ?, totalBorrowed = totalBorrowed + ?, countTimes = countTimes - 1, lastUpdate = datetime("now", "localtime") WHERE uid = ? AND name = ?')
        .bind(totalLentInc, totalBorrowedInc, uid, record.contactName)
    );

    await c.env.DB.batch(batchQueries);
    return c.json({ success: true });
  } catch (err) {
    console.error('deleteRecord Error:', err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default records;
