import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
    file_name: { type: String, required: true },        // stored filename (for reference)
    original_name: { type: String, required: true },    // uploaded filename
    title: { type: String, default: '' },               // optional title
    owner_id: { type: String, required: true },         // user ID
    visibility: { type: String, enum: ['private', 'public'], default: 'private' },
    pages: { type: Number, default: null },             // number of pages in document
    status: { type: String, enum: ['pending', 'indexed'], default: 'pending' },
    uploaded_at: { type: Date, default: Date.now },

    // ✅ Cloudinary fields
    cloud_url: { type: String, required: true },        // direct link to uploaded file
    cloud_public_id: { type: String, required: true },  // Cloudinary public ID (useful for deletion or transformations)
    cloud_resource_type: { type: String, default: 'auto' }, // e.g., 'image', 'raw', 'video'

}, { timestamps: true });

export default mongoose.model('Document', DocumentSchema);
