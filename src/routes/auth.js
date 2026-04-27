import { Hono } from 'hono';
import { sign } from 'hono/jwt';

const auth = new Hono();

auth.post('/login', async (c) => {
  try {
    const { code } = await c.req.json();
    if (!code) {
      return c.json({ success: false, error: 'Code is required' }, 400);
    }

    const APPID = c.env.WX_APPID;
    const SECRET = c.env.WX_APPSECRET;

    // 1. 请求微信服务器换取 openid
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`;
    const response = await fetch(wxUrl);
    const wxData = await response.json();

    const { openid, errcode, errmsg } = wxData;

    if (errcode) {
      console.error('WX Login Error:', errmsg);
      return c.json({ success: false, error: errmsg }, 500);
    }

    // 2. 签发 JWT 令牌
    const payload = {
      openid,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    };
    // 显式指定算法 HS256
    const token = await sign(payload, c.env.JWT_SECRET, 'HS256');

    return c.json({
      success: true,
      token,
      openid
    });
  } catch (error) {
    console.error('Auth Login Exception:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

export default auth;
