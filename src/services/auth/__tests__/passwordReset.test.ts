import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn(), patch: jest.fn() },
}));

import { greenbidz } from '@/api/greenbidzClient';
import { sendResetOtp, verifyResetOtp, resetPassword, ResetError } from '@/services/auth/passwordReset';

type AxiosLikeMock = jest.Mock<any>;
const mockPost = greenbidz.post as AxiosLikeMock;

const axiosError = (status: number, message = 'x') => ({ response: { status, data: { success: false, message } } });

beforeEach((): void => {
  mockPost.mockReset();
});

describe('passwordReset service', () => {
  it('sendResetOtp posts email to the send-otp endpoint (no x-platform arg)', async () => {
    mockPost.mockResolvedValue({ data: { message: 'OTP sent to email' } });
    await sendResetOtp('a@b.com');
    expect(mockPost).toHaveBeenCalledWith('/user/forgot-password/send-otp', { email: 'a@b.com' });
  });

  it('verifyResetOtp posts email+otp', async () => {
    mockPost.mockResolvedValue({ data: { verified: true } });
    await verifyResetOtp('a@b.com', '123456');
    expect(mockPost).toHaveBeenCalledWith('/user/forgot-password/verify-otp', { email: 'a@b.com', otp: '123456' });
  });

  it('resetPassword posts email+otp+newPassword', async () => {
    mockPost.mockResolvedValue({ data: { message: 'Password reset successful' } });
    await resetPassword('a@b.com', '123456', 'supersecret');
    expect(mockPost).toHaveBeenCalledWith('/user/forgot-password/reset', { email: 'a@b.com', otp: '123456', newPassword: 'supersecret' });
  });

  it('maps 404 → NO_ACCOUNT', async () => {
    mockPost.mockRejectedValue(axiosError(404, 'User not found'));
    await expect(sendResetOtp('x@y.com')).rejects.toMatchObject({ code: 'NO_ACCOUNT' });
  });

  it('maps 400 → INVALID_OTP', async () => {
    mockPost.mockRejectedValue(axiosError(400, 'Invalid OTP'));
    await expect(verifyResetOtp('x@y.com', '000000')).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('maps no-response → NETWORK', async () => {
    mockPost.mockRejectedValue({}); // no `response`
    await expect(sendResetOtp('x@y.com')).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('maps other status → UNKNOWN', async () => {
    mockPost.mockRejectedValue(axiosError(500, 'boom'));
    await expect(sendResetOtp('x@y.com')).rejects.toBeInstanceOf(ResetError);
    await expect(sendResetOtp('x@y.com')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});
