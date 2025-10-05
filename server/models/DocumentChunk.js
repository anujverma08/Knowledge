import mongoose from 'mongoose';

const DocumentChunkSchema = new mongoose.Schema({
    document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    page_number: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true } // vector embedding
}, { timestamps: true });

export default mongoose.model('DocumentChunk', DocumentChunkSchema);
