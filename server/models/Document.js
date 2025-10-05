import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
    file_name: { type: String, required: true },       // stored filename on server
    original_name: { type: String, required: true },   // uploaded filename
    title: { type: String, default: '' },             // optional title
    owner_id: { type: String, required: true },       // Clerk user ID
    visibility: { type: String, enum: ['private', 'public'], default: 'private' },
    pages: { type: Number, default: null },           // number of pages in document
    status: { type: String, enum: ['pending', 'indexed'], default: 'pending' }, 
    uploaded_at: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Document', DocumentSchema);
