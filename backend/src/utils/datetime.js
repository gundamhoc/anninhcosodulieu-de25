function pad(value) {
  return String(value).padStart(2, '0');
}

function toMysqlDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  // Lưu theo giờ địa phương của server để dễ đọc trong demo.
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(':');
}

function isFuture(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

module.exports = { toMysqlDateTime, isFuture };
