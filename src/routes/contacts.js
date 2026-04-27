import { Hono } from 'hono';

const contacts = new Hono();

contacts.get('/', async (c) => {
  const user = c.get('jwtPayload');
  const uid = user.openid;

  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM contacts WHERE uid = ? ORDER BY lastUpdate DESC').bind(uid).all();
    return c.json({ success: true, data: results });
  } catch (err) {
    console.error('getContacts Error:', err);
    return c.json({ success: false, error: err.message }, 400);
  }
});

contacts.delete('/:name', async (c) => {
  const user = c.get('jwtPayload');
  const uid = user.openid;
  const name = c.req.param('name');

  try {
    // 检查是否还有关联记录
    const count = await c.env.DB.prepare('SELECT count(*) as total FROM records WHERE uid = ? AND contactName = ?').bind(uid, name).first('total');
    if (count > 0) {
      return c.json({ success: false, error: '该联系人下尚有未删除的记录，无法删除' }, 400);
    }

    await c.env.DB.prepare('DELETE FROM contacts WHERE uid = ? AND name = ?').bind(uid, name).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('deleteContact Error:', err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default contacts;
