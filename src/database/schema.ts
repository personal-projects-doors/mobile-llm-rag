import {appSchema, tableSchema} from '@nozbe/watermelondb';

export default appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'chat_sessions',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'date', type: 'string'},
        {name: 'active_pal_id', type: 'string', isOptional: true},
        {name: 'rag_enabled', type: 'boolean', isOptional: true},
        {name: 'rag_document_ids', type: 'string', isOptional: true}, // JSON string of document IDs
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'messages',
      columns: [
        {name: 'session_id', type: 'string', isIndexed: true},
        {name: 'author', type: 'string'},
        {name: 'text', type: 'string', isOptional: true},
        {name: 'type', type: 'string'},
        {name: 'created_at', type: 'number'},
        {name: 'metadata', type: 'string'}, // JSON stringified
        {name: 'position', type: 'number'}, // For ordering
      ],
    }),
    tableSchema({
      name: 'completion_settings',
      columns: [
        {name: 'session_id', type: 'string', isIndexed: true},
        {name: 'settings', type: 'string'}, // JSON stringified
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'global_settings',
      columns: [
        {name: 'key', type: 'string', isIndexed: true},
        {name: 'value', type: 'string'}, // JSON stringified
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
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
    tableSchema({
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
    tableSchema({
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
});
