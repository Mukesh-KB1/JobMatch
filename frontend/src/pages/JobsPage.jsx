import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import JobCard from '../components/JobCard.jsx';
import { LoadingRow, ErrorBanner, EmptyState, FreshnessBadge } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { countryLabel, COUNTRY_NAMES } from '../utils/countries.js';

export default function JobsPage() {
  const { user } = useAuth();
  const [results, setResults] = useState(null);
  const [freshness, setFreshness] = useState(null);
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  // Country list only needs to be fetched once - it doesn't depend on page
  // or the currently-selected filter. Restricted to the major job markets
  // in COUNTRY_NAMES so the dropdown doesn't fill up with one-off/rare
  // country codes that only have a handful of listings.
  useEffect(() => {
    api.jobsCountries()
      .then((data) => setCountries(data.countries.filter((c) => COUNTRY_NAMES[c])))
      .catch(() => {});
  }, []);

  // Debounce the search box - wait for the user to pause typing before it
  // becomes the value that actually drives the API call and resets pagination.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    // The Jobs page shows AI scores the background cron already computed -
    // fetched and merged here without requiring the user to click anything.
    Promise.all([api.listJobs(page, country, search), api.jobsFreshness()])
      .then(([jobsData, freshnessData]) => {
        if (cancelled) return;
        setResults(jobsData.results);
        setFreshness(freshnessData);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [page, country, search]);

  function handleCountryChange(e) {
    setCountry(e.target.value);
    setPage(1); // filter changed - restart pagination from page 1
  }

  function handleSearchChange(e) {
    setSearchInput(e.target.value);
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
    setPage(1);
  }

  return (
    <div className="page">
      <div className="page-header jobs-heading">
        <div>
          <div className="eyebrow">Signal feed</div>
          <h1>Discover your next role</h1>
          <p>Your opportunities are ranked by fit. Explore the details, then apply with confidence.</p>
        </div>
        <FreshnessBadge freshness={freshness} />
      </div>

      <div className="filter-bar">
        <label htmlFor="job-search" className="filter-label">Search</label>
        <div className="search-input-wrap">
          <svg className="search-input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.6" />
            <path d="M14 14L11 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            id="job-search"
            type="text"
            className="search-input"
            placeholder="Java developer, data science, banking…"
            value={searchInput}
            onChange={handleSearchChange}
          />
          {searchInput && (
            <button type="button" className="search-input-clear" onClick={clearSearch} aria-label="Clear search">
              ×
            </button>
          )}
        </div>

        <label htmlFor="country-filter" className="filter-label">Location</label>
        <select
          id="country-filter"
          className="country-select"
          value={country}
          onChange={handleCountryChange}
        >
          <option value="">All countries</option>
          {countries.map((code) => (
            <option key={code} value={code}>{countryLabel(code)}</option>
          ))}
        </select>
      </div>

      {!user?.emailVerified && (
        <div className="banner banner-warning" style={{ marginTop: 16 }}>
          Your email isn't verified yet - verify it to score your fit, apply, and receive match digests.
        </div>
      )}

      <ErrorBanner message={error} />
      {loading && <LoadingRow label="Loading jobs…" />}

      {!loading && results && results.length === 0 && (
        <EmptyState
          title={search ? `No jobs found for "${search}"` : country ? `No jobs found for ${countryLabel(country)}` : 'No jobs in the pool yet'}
          hint={
            search
              ? 'Try a shorter or more general term, or clear the search to see all active jobs.'
              : country
              ? 'Try a different country, or clear the filter to see all active jobs.'
              : 'Run the bootstrap sync (see README) to populate the shared job pool, or check back after the next ingestion cycle.'
          }
        />
      )}

      {!loading && results && results.length > 0 && (
        <div className="jobs-list">
          {results.map((entry) => (
            <JobCard key={entry.job._id} entry={entry} verified={!!user?.emailVerified} />
          ))}
        </div>
      )}

      {!loading && results && results.length > 0 && (
        <div className="pagination">
          <button className="btn" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
          <span className="pagination-page mono">page {page}</span>
          <button className="btn" type="button" onClick={() => setPage((p) => p + 1)} disabled={results.length < 20}>Next</button>
        </div>
      )}
    </div>
  );
}