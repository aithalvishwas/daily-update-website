package com.dailyupdate.project;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AttachmentRepository {

    public record Attachment(long id, String ownerType, Long ownerId, long uploaderId, String filename,
            String contentType, long sizeBytes, String storageKey, OffsetDateTime createdAt) {

        public Info info() {
            return new Info(id, filename, contentType, sizeBytes, createdAt);
        }
    }

    /** What the website sees: no storage details. */
    public record Info(long id, String filename, String contentType, long sizeBytes, OffsetDateTime createdAt) {}

    private static final String COLUMNS =
            "id, owner_type, owner_id, uploader_id, filename, content_type, size_bytes, storage_key, created_at";

    private final JdbcClient jdbc;

    public AttachmentRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Attachment insert(long uploaderId, String filename, String contentType, long size, String storageKey) {
        return jdbc.sql("""
                        INSERT INTO attachments (uploader_id, filename, content_type, size_bytes, storage_key)
                        VALUES (:uploader, :filename, :type, :size, :key) RETURNING """ + " " + COLUMNS)
                .param("uploader", uploaderId)
                .param("filename", filename)
                .param("type", contentType)
                .param("size", size)
                .param("key", storageKey)
                .query(Attachment.class)
                .single();
    }

    public Optional<Attachment> findById(long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM attachments WHERE id = :id")
                .param("id", id).query(Attachment.class).optional();
    }

    public List<Attachment> findByIds(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("SELECT " + COLUMNS + " FROM attachments WHERE id IN (:ids) ORDER BY id")
                .param("ids", ids).query(Attachment.class).list();
    }

    public List<Info> findByOwner(String ownerType, long ownerId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM attachments WHERE owner_type = :type AND owner_id = :id ORDER BY id")
                .param("type", ownerType).param("id", ownerId)
                .query(Attachment.class).list().stream().map(Attachment::info).toList();
    }

    /** Links the uploader's own, still-unlinked files to an issue or reply. */
    public void link(Collection<Long> ids, long uploaderId, String ownerType, long ownerId) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        jdbc.sql("""
                        UPDATE attachments SET owner_type = :type, owner_id = :ownerId
                        WHERE id IN (:ids) AND uploader_id = :uploader AND owner_type IS NULL""")
                .param("type", ownerType)
                .param("ownerId", ownerId)
                .param("ids", ids)
                .param("uploader", uploaderId)
                .update();
    }
}
