
export function sendSuccess(
  res,
  {
    data = null,
    statusCode = 200,
    message = 'Request successful',
  } = {},
) {
  return res.status(statusCode).json({
    data,
    isSuccess: true,
    statusCode,
    message,
  });
}
