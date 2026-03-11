import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import GrangerSection from './components/GrangerSection.jsx';
import HMMSection from './components/HMMSection.jsx';
import XGBoostSection from './components/XGBoostSection.jsx';
import Footer from './components/Footer.jsx';
import { loadAllData } from './utils/dataLoader.js';

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
      <div className="loading">
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
      <main>
        <GrangerSection data={data.granger} prices={data.prices} />
        <HMMSection data={data.hmm} prices={data.prices} />
        <XGBoostSection data={data.xgboost} prices={data.prices} />
      </main>
      <Footer />
    </div>
  );
}
