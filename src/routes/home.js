import { Hono } from 'hono';

const home = new Hono();

home.get('/stats', async (c) => {
  const user = c.get('jwtPayload');
  const uid = user.openid;
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // 1 & 2. 并行获取所有待处理记录和累计金额
    const [pendingRes, statsRes] = await Promise.all([
      c.env.DB.prepare('SELECT amount, repaidAmount, type, dueDate FROM records WHERE uid = ? AND status = "pending"').bind(uid).all(),
      c.env.DB.prepare(`
        SELECT 
          SUM(CASE WHEN type = 'lend' THEN amount ELSE 0 END) as totalLent,
          SUM(CASE WHEN type = 'borrow' THEN amount ELSE 0 END) as totalBorrowed
        FROM records 
        WHERE uid = ?
      `).bind(uid).first()
    ]);

    const pendingRecords = pendingRes.results || [];
    const totalStats = statsRes || { totalLent: 0, totalBorrowed: 0 };

    let balanceLent = 0;
    let balanceBorrowed = 0;
    let overdueCount = 0;
    let dueTodayCount = 0;

    pendingRecords.forEach(r => {
      const remainingAmount = r.amount - (r.repaidAmount || 0);
      if (r.type === 'lend') balanceLent += remainingAmount;
      if (r.type === 'borrow') balanceBorrowed += remainingAmount;

      if (r.dueDate) {
        if (r.dueDate < todayStr) {
          overdueCount++;
        } else if (r.dueDate === todayStr) {
          dueTodayCount++;
        }
      }
    });

    return c.json({
      success: true,
      stats: {
        balanceLent,
        balanceBorrowed,
        totalLent: totalStats.totalLent || 0,
        totalBorrowed: totalStats.totalBorrowed || 0,
        overdueCount,
        dueTodayCount,
        expiryCount: overdueCount + dueTodayCount
      }
    });
  } catch (err) {
    console.error('getHomeStats Error:', err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default home;
