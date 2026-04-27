import { Hono } from 'hono';

const contacts = new Hono();

contacts.get('/', async (c) => {
  const user = c.get('jwtPayload');
  const uid = user.openid;

  try {
    // 使用 rowid 别名为 _id 以兼容前端，增加 LIMIT 200 防止大数据量卡顿
    const { results } = await c.env.DB.prepare('SELECT rowid as _id, * FROM contacts WHERE uid = ? ORDER BY lastUpdate DESC LIMIT 200').bind(uid).all();
    return c.json({ success: true, data: results });
  } catch (err) {
    console.error('getContacts Error:', err);
    return c.json({ success: false, error: err.message }, 400);
  }
});

contacts.get('/:name', async (c) => {
  const user = c.get('jwtPayload');
  const uid = user.openid;
  const name = c.req.param('name');

  try {
    const contact = await c.env.DB.prepare('SELECT rowid as _id, * FROM contacts WHERE uid = ? AND name = ?').bind(uid, name).first();
    if (!contact) return c.json({ success: false, error: 'Contact not found' }, 404);
    return c.json({ success: true, data: contact });
  } catch (err) {
    console.error('getContactByName Error:', err);
    return c.json({ success: false, error: err.message }, 400);
  }
});

contacts.delete('/:name', async (c) => {
  const user = c.get('jwtPayload');
  const uid = user.openid;
  const name = c.req.param('name');

  try {
    const contact = await c.env.DB.prepare('SELECT * FROM contacts WHERE uid = ? AND name = ?').bind(uid, name).first();
    if (!contact) return c.json({ success: false, error: 'Contact not found' }, 404);

    const batchQueries = [];
    
    // 1. 删除联系人
    batchQueries.push(c.env.DB.prepare('DELETE FROM contacts WHERE uid = ? AND name = ?').bind(uid, name));

    // 2. 删除该联系人的所有记录
    batchQueries.push(c.env.DB.prepare('DELETE FROM records WHERE uid = ? AND contactName = ?').bind(uid, name));

    await c.env.DB.batch(batchQueries);
    return c.json({ success: true });
  } catch (err) {
    console.error('deleteContact Error:', err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default contacts;
