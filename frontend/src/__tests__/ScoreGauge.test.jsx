import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import ScoreGauge from '../components/ScoreGauge.jsx';

describe('ScoreGauge', () => {
  test('renders the rounded score as visible text', () => {
    render(<ScoreGauge score={82.6} />);
    expect(screen.getByText('83')).toBeInTheDocument();
  });

  test('labels a high score as strong signal (green band)', () => {
    render(<ScoreGauge score={90} />);
    expect(screen.getByText('Strong signal')).toBeInTheDocument();
  });

  test('labels a mid score as partial signal (amber band)', () => {
    render(<ScoreGauge score={60} />);
    expect(screen.getByText('Partial signal')).toBeInTheDocument();
  });

  test('labels a low score as weak signal (red band)', () => {
    render(<ScoreGauge score={20} />);
    expect(screen.getByText('Weak signal')).toBeInTheDocument();
  });

  test('clamps an out-of-range score into 0-100 for display', () => {
    render(<ScoreGauge score={150} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  test('treats a missing score as 0 rather than crashing', () => {
    render(<ScoreGauge score={undefined} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  test('exposes an accessible label for screen readers', () => {
    render(<ScoreGauge score={82} label="Frontend Engineer" />);
    expect(screen.getByRole('img', { name: /Frontend Engineer.*82 out of 100/i })).toBeInTheDocument();
  });
});
