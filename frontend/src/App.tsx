import { useState, useEffect } from 'react'

interface EventData {
  id: string
  title: string
  source: string
  description: string
  validity: string
  impact: string
}

function App() {
  const [events, setEvents] = useState<EventData[]>([])

  useEffect(() => {
    // Stub for fetching data from the backend
    setEvents([
      {
        id: '1',
        title: 'Suspicious Activity Detected',
        source: 'Brave Search',
        description: 'Reports of unusual gatherings in downtown sector.',
        validity: 'VERIFIED',
        impact: 'CRITICAL',
      },
    ])
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <header className="mb-8 border-b border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-blue-400">LEIS Dashboard</h1>
      </header>
      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div key={event.id} className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-2">{event.title}</h2>
            <p className="text-sm text-gray-400 mb-4">{event.description}</p>
          </div>
        ))}
      </main>
    </div>
  )
}

export default App
