/**
 * Menambah kaedah gaya-Vercel (res.status().json()/.send()) pada objek
 * ServerResponse Node biasa. Dikongsi oleh scripts/devServer.js dan ujian.
 */
function wrapResponse(res) {
  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function json(obj) {
    const body = JSON.stringify(obj);
    res.setHeader && res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(body);
    return res;
  };
  res.send = function send(body) {
    res.end(body);
    return res;
  };
  return res;
}

module.exports = { wrapResponse };
