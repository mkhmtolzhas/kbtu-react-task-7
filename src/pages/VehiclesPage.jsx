import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import FleetSummary from '../components/FleetSummary.jsx';
import Pagination from '../components/Pagination.jsx';
import SearchBar from '../components/SearchBar.jsx';
import SortControl from '../components/SortControl.jsx';
import Spinner from '../components/Spinner.jsx';
import VehicleGrid from '../components/VehicleGrid.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { useCacheStatus } from '../hooks/useCacheStatus.js';
import { useVehiclesQuery } from '../hooks/useVehicleQueries.js';
import { fleetUrl } from '../api/endpoints.js';
import { PAGE_SIZES } from '../utils/constants.js';
import { formatCachedAt, pluralize } from '../utils/format.js';

const SEARCH_DEBOUNCE_MS = 400;

// The URL is the single source of truth for the view: a filtered list can be
// shared, bookmarked, reloaded and walked through with Back/Forward. Default
// values are left out of the query string so a plain /vehicles stays plain.
const DEFAULTS = {
  q: '',
  status: 'all',
  class: 'all',
  district: 'all',
  sort: 'plate',
  dir: 'asc',
  page: '1',
  size: String(PAGE_SIZES[0]),
};

const FILTER_PARAMS = ['q', 'status', 'class', 'district'];

export default function VehiclesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Reset token for the per-card checks: changing it gives every card a new key,
  // which is how React is told to throw the old state away (component identity).
  const [checksToken, setChecksToken] = useState(0);

  const urlSearch = searchParams.get('q') ?? DEFAULTS.q;
  // Only the request is debounced: the input itself stays in sync with the URL.
  const search = useDebouncedValue(urlSearch.trim(), SEARCH_DEBOUNCE_MS);

  const query = useMemo(() => ({
    status: searchParams.get('status') ?? DEFAULTS.status,
    vehicleClass: searchParams.get('class') ?? DEFAULTS.class,
    district: searchParams.get('district') ?? DEFAULTS.district,
    sortBy: searchParams.get('sort') ?? DEFAULTS.sort,
    sortDir: searchParams.get('dir') ?? DEFAULTS.dir,
    page: Number(searchParams.get('page') ?? DEFAULTS.page),
    pageSize: Number(searchParams.get('size') ?? DEFAULTS.size),
  }), [searchParams]);

  const {
    data: result,
    isPending,
    isFetching,
    isError,
    error,
    refetch,
  } = useVehiclesQuery({ ...query, search });

  const cacheStatus = useCacheStatus(fleetUrl());

  /**
   * Writes the view into the URL. `replace` keeps typing and filtering out of the
   * history stack; only real navigation (opening a vehicle) adds an entry.
   */
  function updateParams(changes, { keepPage = false } = {}) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(changes)) {
        if (value === DEFAULTS[key] || value === '' || value === null) next.delete(key);
        else next.set(key, String(value));
      }
      // Any change to what is being looked for starts again from the first page.
      if (!keepPage && !('page' in changes)) next.delete('page');
      return next;
    }, { replace: true });
  }

  function handleStatusTileSelect(status) {
    // Clicking the active tile again turns the status filter off.
    updateParams({ status: query.status === status ? 'all' : status });
  }

  function handleFilterChange(name, value) {
    const param = name === 'vehicleClass' ? 'class' : name;
    updateParams({ [param]: value });
  }

  function handlePageChange(page) {
    updateParams({ page }, { keepPage: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleResetFilters() {
    updateParams({ q: '', status: 'all', class: 'all', district: 'all' });
  }

  const hasActiveFilters = FILTER_PARAMS.some((param) => {
    const value = searchParams.get(param);
    return value !== null && value !== DEFAULTS[param];
  });
  const isSearchPending = urlSearch.trim() !== search;
  // "Busy" covers a pending debounce and a background revalidation alike.
  const isBusy = isFetching || isSearchPending;

  let content;
  if (isError) {
    content = (
      <ErrorMessage
        title={error.offline ? 'You are offline' : 'Could not load vehicles'}
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  } else if (isPending) {
    content = <Spinner label="Loading vehicles…" />;
  } else if (result.total === 0) {
    content = (
      <EmptyState
        title="No vehicles match"
        message="Nothing in the fleet fits this search and these filters. Try widening them."
      >
        <button type="button" className="button button--primary" onClick={handleResetFilters}>
          Reset filters
        </button>
      </EmptyState>
    );
  } else if (result.items.length === 0) {
    content = (
      <EmptyState title="This page is empty" message="The fleet has fewer pages than the one you opened.">
        <button type="button" className="button button--primary" onClick={() => handlePageChange(1)}>
          Go to first page
        </button>
      </EmptyState>
    );
  } else {
    content = (
      <>
        <VehicleGrid vehicles={result.items} busy={isBusy} resetToken={checksToken} />
        <Pagination
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          onPageChange={handlePageChange}
          onPageSizeChange={(pageSize) => updateParams({ size: pageSize })}
        />
      </>
    );
  }

  // While new data loads, the previous summary stays visible with an "Updating…" mark.
  let summary = '';
  if (result && !isError && result.items.length > 0) {
    const from = (result.page - 1) * result.pageSize + 1;
    const to = from + result.items.length - 1;
    summary = `Showing ${from}–${to} of ${pluralize(result.total, 'vehicle')}`;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Fleet overview</h1>
          <p className="page-header__subtitle">
            Find a car, check its fuel and service state, and open it to change its status.
          </p>
        </div>
        <Link className="button button--primary" to="/vehicles/new">
          <span aria-hidden="true">+</span> Add vehicle
        </Link>
      </header>

      <FleetSummary activeStatus={query.status} onStatusSelect={handleStatusTileSelect} />

      <section className="toolbar" aria-label="Search, filter and sort">
        <SearchBar value={urlSearch} onChange={(value) => updateParams({ q: value })} />
        <div className="toolbar__controls">
          <FilterPanel
            filters={{ status: query.status, vehicleClass: query.vehicleClass, district: query.district }}
            onFilterChange={handleFilterChange}
          />
          <SortControl
            sortBy={query.sortBy}
            sortDir={query.sortDir}
            onSortByChange={(sortBy) => updateParams({ sort: sortBy })}
            onSortDirToggle={() => updateParams({ dir: query.sortDir === 'asc' ? 'desc' : 'asc' })}
          />
          <button
            type="button"
            className="button button--ghost toolbar__reset"
            onClick={handleResetFilters}
            disabled={!hasActiveFilters}
          >
            Reset filters
          </button>
        </div>
      </section>

      <section className="results" aria-label="Vehicles">
        <div className="results__bar">
          <p className="results__summary" aria-live="polite">
            {summary}
            {summary && isBusy && <span className="results__updating"> · Updating…</span>}
            {summary && cacheStatus.fromCache && (
              <span className="results__cached">
                {' · saved copy '}
                {formatCachedAt(cacheStatus.cachedAt)}
              </span>
            )}
          </p>
          <div className="results__actions">
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={() => setChecksToken((token) => token + 1)}
            >
              Reset checks
            </button>
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? 'Reloading…' : 'Reload'}
            </button>
          </div>
        </div>
        {content}
      </section>
    </div>
  );
}
