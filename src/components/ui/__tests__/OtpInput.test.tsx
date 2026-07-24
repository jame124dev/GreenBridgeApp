import { describe, it, expect, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react-native';
import { OtpInput } from '@/components/ui/OtpInput';

describe('OtpInput', () => {
  it('reports each keystroke via onChange and strips non-digits', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<OtpInput value="" onChange={onChange} />);
    fireEvent.changeText(getByTestId('otp-input'), '12a3');
    expect(onChange).toHaveBeenCalledWith('123');
  });

  it('fires onComplete once the full 6 digits are entered', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(<OtpInput value="12345" onChange={() => {}} onComplete={onComplete} />);
    fireEvent.changeText(getByTestId('otp-input'), '123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('does not fire onComplete before the code is full', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(<OtpInput value="" onChange={() => {}} onComplete={onComplete} />);
    fireEvent.changeText(getByTestId('otp-input'), '12');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('fires onComplete once, not again, for the same full value', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(<OtpInput value="" onChange={() => {}} onComplete={onComplete} />);
    fireEvent.changeText(getByTestId('otp-input'), '123456');
    fireEvent.changeText(getByTestId('otp-input'), '123456');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('re-fires onComplete after the value is externally cleared (retry autofill)', () => {
    const onComplete = jest.fn();
    const { getByTestId, rerender } = render(<OtpInput value="" onChange={() => {}} onComplete={onComplete} />);
    fireEvent.changeText(getByTestId('otp-input'), '123456');           // fires #1, guard set
    rerender(<OtpInput value="123456" onChange={() => {}} onComplete={onComplete} />); // reflects full value, guard stays
    rerender(<OtpInput value="" onChange={() => {}} onComplete={onComplete} />);       // external clear → useEffect re-arms
    fireEvent.changeText(getByTestId('otp-input'), '654321');           // fires #2
    expect(onComplete).toHaveBeenCalledTimes(2);
  });
});
