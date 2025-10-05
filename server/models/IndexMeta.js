import mongoose from 'mongoose';

const IndexMetaSchema = new mongoose.Schema({
  last_rebuild: { type: Date },
  last_error: { type: String, default: null },
  total_docs: { type: Number, default: 0 },
  total_chunks: { type: Number, default: 0 },
});

export default mongoose.model('IndexMeta', IndexMetaSchema);
