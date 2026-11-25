// Pembantu untuk meniru bentuk response API Contract (draft v0.1):
// sukses: { success, message, data, meta } — error: { success:false, code, message, errors }
export const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms));

export async function mockOk(data, { message = "Berhasil", meta = null, ms } = {}) {
  await wait(ms);
  return { success: true, message, data, meta };
}

export async function mockFail(status, code, message, errors = []) {
  await wait();
  const err = new Error(message);
  err.response = { status, data: { success: false, code, message, errors } };
  throw err;
}
