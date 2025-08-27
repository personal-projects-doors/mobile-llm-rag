import {schemaMigrations, createTable, addColumns} from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    // Initial migration is handled by the schema
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'rag_documents',
          columns: [
            {name: 'name', type: 'string'},
            {name: 'file_path', type: 'string'},
            {name: 'size', type: 'number'},
            {name: 'page_count', type: 'number'},
            {name: 'processed_at', type: 'number', isOptional: true},
            {name: 'is_processed', type: 'boolean'},
            {name: 'chunk_count', type: 'number'},
            {name: 'is_enabled', type: 'boolean'},
            {name: 'created_at', type: 'number'},
            {name: 'updated_at', type: 'number'},
          ],
        }),
        createTable({
          name: 'rag_chunks',
          columns: [
            {name: 'document_id', type: 'string', isIndexed: true},
            {name: 'text', type: 'string'},
            {name: 'page_number', type: 'number'},
            {name: 'chunk_index', type: 'number'},
            {name: 'embedding', type: 'string', isOptional: true}, // JSON serialized array
            {name: 'start_char', type: 'number'},
            {name: 'end_char', type: 'number'},
            {name: 'token_count', type: 'number'},
            {name: 'created_at', type: 'number'},
          ],
        }),
        createTable({
          name: 'rag_settings',
          columns: [
            {name: 'chunk_size', type: 'number'},
            {name: 'overlap', type: 'number'},
            {name: 'max_results', type: 'number'},
            {name: 'min_similarity', type: 'number'},
            {name: 'preserve_sentences', type: 'boolean'},
            {name: 'created_at', type: 'number'},
            {name: 'updated_at', type: 'number'},
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'chat_sessions',
          columns: [
            {name: 'rag_enabled', type: 'boolean', isOptional: true},
            {name: 'rag_document_ids', type: 'string', isOptional: true},
          ],
        }),
      ],
    },
  ],
});
