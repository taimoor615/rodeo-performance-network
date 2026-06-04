import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getContractorRankings } from '../services/wordpressApi'

export default function ContractorRankingsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getContractorRankings()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="loading">Loading contractor rankings...</p>
  if (error) return <p className="error">Error: {error}</p>

  const rankings = data?.rankings ?? []

  return (
    <div className="contractor-rankings-page rankings-page">
      <div className="rankings-page-header">
        <Link to="/contractors" className="back-link">← Back to Contractors</Link>
        <h1>Contractor Rankings</h1>
        <p>Ranked by the average performance (SRI/TEI) of their linked bulls and bucking horses.</p>
      </div>

      {rankings.length === 0 ? (
        <p className="placeholder">No contractor rankings yet. Contractors with linked animals will appear here.</p>
      ) : (
        <div className="rpn-card">
          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Contractor</th>
                  <th>Score</th>
                  <th>CRI</th>
                  <th>Animals</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((row) => (
                  <tr key={row.id}>
                    <td className="leaderboard-index">#{row.rank}</td>
                    <td>
                      <Link to={`/contractors/${row.slug}`} className="leaderboard-name">
                        {row.title}
                      </Link>
                    </td>
                    <td>
                      {row.rank_score != null ? Number(row.rank_score).toFixed(1) : '—'}
                    </td>
                    <td>
                      {row.cri != null ? Number(row.cri).toFixed(1) : '—'}
                    </td>
                    <td>{row.animal_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
