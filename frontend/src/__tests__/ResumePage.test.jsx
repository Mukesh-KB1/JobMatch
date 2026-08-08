import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import ResumePage from '../pages/ResumePage.jsx';

vi.mock('../api/client.js', () => ({
  api: {
    listResumes: vi.fn(),
    uploadResume: vi.fn(),
  },
}));

import { api } from '../api/client.js';

describe('ResumePage', () => {
  test('shows a loading indicator while resumes are being fetched', () => {
    api.listResumes.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ResumePage />);
    expect(screen.getByText(/loading your resumes/i)).toBeInTheDocument();
  });

  test('shows an empty state with next-step guidance when there are no resumes', async () => {
    api.listResumes.mockResolvedValue({ resumes: [] });
    render(<ResumePage />);
    await waitFor(() => expect(screen.getByText(/no resume yet/i)).toBeInTheDocument());
    expect(screen.getByText(/upload one above/i)).toBeInTheDocument();
  });

  test('renders populated resume rows once data loads, marking the active one', async () => {
    api.listResumes.mockResolvedValue({
      resumes: [
        { _id: '1', originalFilename: 'me.pdf', isActive: true, parseStatus: 'parsed', skills: ['react', 'node.js'], experienceYears: 4 },
        { _id: '2', originalFilename: 'old.pdf', isActive: false, parseStatus: 'parsed', skills: [], experienceYears: null },
      ],
    });
    render(<ResumePage />);
    await waitFor(() => expect(screen.getByText('me.pdf')).toBeInTheDocument());
    expect(screen.getByText('old.pdf')).toBeInTheDocument();
    expect(screen.getByText(/· active/)).toBeInTheDocument();
    expect(screen.getByText(/2 skills detected/)).toBeInTheDocument();
  });
});
