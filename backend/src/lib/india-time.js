const INDIA_TIME_ZONE = 'Asia/Kolkata';

const partsToObject = (parts) => Object.fromEntries(
  parts
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value])
);

function getIndiaDateTime(value = new Date()) {
  // Build the database values from named Intl parts. Do not depend on a
  // locale's rendered order: packaged Node may render en-CA as M/D/YYYY.
  const dateParts = partsToObject(new Intl.DateTimeFormat('en-US', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value));
  const timeParts = partsToObject(new Intl.DateTimeFormat('en-US', {
    timeZone: INDIA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value));

  return {
    date: `${dateParts.year}-${dateParts.month}-${dateParts.day}`,
    time: `${timeParts.hour}-${timeParts.minute}-${timeParts.second}`.replace(/-/g, ':'),
  };
}

module.exports = { INDIA_TIME_ZONE, getIndiaDateTime };
