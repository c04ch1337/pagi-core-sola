
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import SystemRegistry from './SystemRegistry';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock lucide-react to avoid issues with icon rendering in tests
jest.mock('lucide-react', () => ({
  Search: () => <div data-testid="icon-search" />,
  BarChart3: () => <div data-testid="icon-barchart" />,
  Download: () => <div data-testid="icon-download" />,
  Filter: () => <div data-testid="icon-filter" />,
  Database: () => <div data-testid="icon-database" />,
  Zap: () => <div data-testid="icon-zap" />,
  UserCircle: () => <div data-testid="icon-user" />,
  Cpu: () => <div data-testid="icon-cpu" />,
  CheckCircle2: () => <div data-testid="icon-check-circle" />,
  RefreshCcw: () => <div data-testid="icon-refresh" />,
  XCircle: () => <div data-testid="icon-x-circle" />,
  Eye: () => <div data-testid="icon-eye" />,
  Terminal: () => <div data-testid="icon-terminal" />,
  RotateCw: () => <div data-testid="icon-rotate" />,
  Check: () => <div data-testid="icon-check" />,
  X: () => <div data-testid="icon-x" />,
  ShieldCheck: () => <div data-testid="icon-shield" />,
  Activity: () => <div data-testid="icon-activity" />,
  History: () => <div data-testid="icon-history" />,
  Info: () => <div data-testid="icon-info" />,
  ClipboardList: () => <div data-testid="icon-clipboard" />,
  ChevronDown: () => <div data-testid="icon-chevron-down" />,
  ArrowUpDown: () => <div data-testid="icon-arrow-up-down" />,
}));

describe('SystemRegistry Component', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  test('renders title and initial telemetry data', () => {
    render(<SystemRegistry />);
    expect(screen.getByText('System Registry')).toBeInTheDocument();
    expect(screen.getByText('Core.PAGI')).toBeInTheDocument();
    expect(screen.getByText('KB.GlobalRegistry')).toBeInTheDocument();
  });

  test('filters by search term (Identifier)', () => {
    render(<SystemRegistry />);
    const searchInput = screen.getByPlaceholderText('Query components...');
    fireEvent.change(searchInput, { target: { value: 'Core.PAGI' } });
    
    expect(screen.getByText('Core.PAGI')).toBeInTheDocument();
    expect(screen.queryByText('KB.GlobalRegistry')).not.toBeInTheDocument();
  });

  test('filters by categorization (Logic Engine)', () => {
    render(<SystemRegistry />);
    const filterBtn = screen.getByTitle('Filter by Logic Engine');
    fireEvent.click(filterBtn);
    
    expect(screen.getByText('Core.PAGI')).toBeInTheDocument();
    expect(screen.getByText('IO.WebInference')).toBeInTheDocument();
    expect(screen.queryByText('KB.GlobalRegistry')).not.toBeInTheDocument();
  });

  test('filters by operational status (offline)', () => {
    render(<SystemRegistry />);
    const offlineFilter = screen.getByTitle('Filter by offline');
    fireEvent.click(offlineFilter);
    
    expect(screen.getByText('KB.FinancialData')).toBeInTheDocument();
    expect(screen.queryByText('Core.PAGI')).not.toBeInTheDocument();
  });

  test('triggers component diagnostic modal', () => {
    render(<SystemRegistry />);
    const viewDetailsBtns = screen.getAllByTitle('View Details');
    fireEvent.click(viewDetailsBtns[0]);

    expect(screen.getByText('Component Diagnostic')).toBeInTheDocument();
    expect(screen.getByText('Extended Telemetry')).toBeInTheDocument();
  });

  test('simulates CSV export trigger', () => {
    const mockCreateObjectURL = jest.fn().mockReturnValue('mock-url') as any;
    const mockRevokeObjectURL = jest.fn() as any;
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;
    
    const mockAnchor = {
      setAttribute: jest.fn(),
      click: jest.fn(),
      style: {},
      remove: jest.fn(),
    } as any;
    
    (document as any).createElement = jest.fn().mockReturnValue(mockAnchor);
    (document.body as any).appendChild = jest.fn();
    (document.body as any).removeChild = jest.fn();

    render(<SystemRegistry />);
    const exportBtn = screen.getByText('Export CSV');
    fireEvent.click(exportBtn);

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(mockAnchor.setAttribute).toHaveBeenCalledWith('download', expect.stringContaining('telemetry_export'));
    expect(mockAnchor.click).toHaveBeenCalled();
  });
});
