import React from 'react'
import { render } from 'react-dom'

function App() {
  return <div>Hello</div>
}

let root = document.getElementById('root')
if (!root) {
  root = document.createElement('div')
  document.body.appendChild(root)
}

render(<App/>, root)
