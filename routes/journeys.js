const express = require('express');
const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ message: 'Journey routes working' });
});

router.get('/progress/:email', (req, res) => {
  res.json({
    status: 'success',
    data: { progress: null }
  });
});

router.get('/stats', (req, res) => {
  res.json({
    status: 'success',
    data: { message: 'Stats working' }
  });
});

router.post('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Journey creation working'
  });
});

router.get('/', (req, res) => {
  res.json({
    status: 'success',
    data: { journeys: [] }
  });
});

router.get('/:id', (req, res) => {
  res.json({
    status: 'success',
    data: { journey: { id: req.params.id } }
  });
});

router.delete('/:id', (req, res) => {
  res.json({ status: 'success', message: 'Delete working' });
});

router.patch('/:id/steps/:stepId', (req, res) => {
  res.json({ status: 'success', message: 'Step update working' });
});

router.patch('/:id/checklist', (req, res) => {
  res.json({ status: 'success', message: 'Checklist working' });
});

router.patch('/:id/personalization', (req, res) => {
  res.json({ status: 'success', message: 'Personalization working' });
});

router.post('/:id/share', (req, res) => {
  res.json({ status: 'success', message: 'Share working' });
});

router.post('/:id/notes', (req, res) => {
  res.json({ status: 'success', message: 'Notes working' });
});

module.exports = router;