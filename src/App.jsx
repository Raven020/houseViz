import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import GrangerSection from './components/GrangerSection.jsx';
import HMMSection from './components/HMMSection.jsx';
import LightGBMSection from './components/LightGBMSection.jsx';
import Footer from './components/Footer.jsx';
import { loadAllData } from './utils/dataLoader.js';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message || 'An unexpected error occurred while rendering a chart.'}</p>
          <p>Try refreshing the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData()
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="loading" role="status" aria-live="polite">
        <div className="spinner" />
        <p>Loading analysis data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <h2>Unable to load data</h2>
        <p>{error}</p>
        <p>Ensure the JSON data files are present in the <code>public/data/</code> directory.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />
      <ErrorBoundary>
        <main>
          <GrangerSection data={data.granger} prices={data.prices} />
          <HMMSection data={data.hmm} prices={data.prices} />
          <LightGBMSection data={data.lightgbm} prices={data.prices} />
        </main>
      </ErrorBoundary>
      <Footer />
    </div>
  );
}
