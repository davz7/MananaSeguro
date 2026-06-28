import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildHistoryEntry,
  addHistoryEntry,
  loadHistory,
  saveHistory
} from './contributionHistoryUtils';
import { MANANA_SEGURO_RATES } from '../../../data/retirementContent';

describe('contributionHistoryUtils', () => {
  let mockStorage = {};

  const localStorageMock = {
    getItem: vi.fn((key) => mockStorage[key] ?? null),
    setItem: vi.fn((key, value) => {
      mockStorage[key] = value.toString();
    }),
    clear: vi.fn(() => {
      mockStorage = {};
    }),
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('loadHistory', () => {
    it('returns [] when storage is empty', () => {
      const history = loadHistory('test-wallet');
      expect(history).toEqual([]);
    });

    it('parses stored JSON otherwise', () => {
      const data = [{ id: 1, amount: 10 }];
      mockStorage['manana_seguro_history_test-wallet'] = JSON.stringify(data);
      const history = loadHistory('test-wallet');
      expect(history).toEqual(data);
    });

    it('returns [] when localStorage throws', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Access denied');
      });
      const history = loadHistory('test-wallet');
      expect(history).toEqual([]);
    });
  });

  describe('saveHistory', () => {
    it('writes under the wallet-scoped key', () => {
      const data = [{ id: 1, amount: 10 }];
      saveHistory('test-wallet', data);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'manana_seguro_history_test-wallet',
        JSON.stringify(data)
      );
      expect(mockStorage['manana_seguro_history_test-wallet']).toBe(JSON.stringify(data));
    });

    it('uses demo as fallback wallet', () => {
      const data = [{ id: 1, amount: 10 }];
      saveHistory(null, data);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'manana_seguro_history_demo',
        JSON.stringify(data)
      );
    });

    it('does not throw when storage is unavailable', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage full');
      });
      expect(() => saveHistory('test-wallet', [])).not.toThrow();
    });
  });

  describe('buildHistoryEntry', () => {
    it('with empty history, balanceAfter equals the deposit amount plus zero yield', () => {
      const entry = buildHistoryEntry(100, 'test-wallet');
      expect(entry.amount).toBe(100);
      expect(entry.yieldAccrued).toBe(0);
      expect(entry.balanceAfter).toBe(100);
      expect(entry.type).toBe('deposito');
      expect(entry.confirmed).toBe(true);
    });

    it('with prior history, yield is prevBalance * monthlyRate and balanceAfter compounds correctly', () => {
      const prevBalance = 1000;
      mockStorage['manana_seguro_history_test-wallet'] = JSON.stringify([
        { id: 1, balanceAfter: prevBalance }
      ]);

      const monthlyRate = MANANA_SEGURO_RATES.userRate / 100 / 12;
      const expectedYield = parseFloat((prevBalance * monthlyRate).toFixed(4));
      const depositAmount = 50;

      const entry = buildHistoryEntry(depositAmount, 'test-wallet');

      expect(entry.amount).toBe(depositAmount);
      expect(entry.yieldAccrued).toBe(expectedYield);
      expect(entry.balanceAfter).toBe(parseFloat((prevBalance + depositAmount + expectedYield).toFixed(4)));
    });
  });

  describe('addHistoryEntry', () => {
    it('prepends the new entry (newest first) and persists', () => {
      const existingEntry = { id: 1, amount: 50, balanceAfter: 50 };
      mockStorage['manana_seguro_history_test-wallet'] = JSON.stringify([existingEntry]);

      const newEntry = { id: 2, amount: 100, balanceAfter: 150 };
      const result = addHistoryEntry('test-wallet', newEntry);

      expect(result).toEqual([newEntry, existingEntry]);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'manana_seguro_history_test-wallet',
        JSON.stringify([newEntry, existingEntry])
      );
    });
  });
});
