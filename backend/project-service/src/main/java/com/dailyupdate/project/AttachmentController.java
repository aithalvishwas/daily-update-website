package com.dailyupdate.project;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.SecuritySupport;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Photos and files for daily updates and issues, stored on a local volume. */
@RestController
@RequestMapping("/api/attachments")
public class AttachmentController {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/png", "image/jpeg", "image/gif", "image/webp",
            "application/pdf", "text/plain", "text/csv",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/zip");

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AttachmentRepository attachments;
    private final IssueRepository issues;
    private final Path dir;

    public AttachmentController(AttachmentRepository attachments, IssueRepository issues,
            @Value("${app.uploads-dir}") String uploadsDir) throws IOException {
        this.attachments = attachments;
        this.issues = issues;
        this.dir = Path.of(uploadsDir).toAbsolutePath().normalize();
        Files.createDirectories(dir);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, AttachmentRepository.Info> upload(@RequestParam("file") MultipartFile file) throws IOException {
        AuthUser me = SecuritySupport.currentUser();
        if (file.isEmpty()) {
            throw new ApiException(400, "The file is empty");
        }
        String type = detectType(file);
        if (!ALLOWED_TYPES.contains(type)) {
            throw new ApiException(415, "Only images, PDF, text, CSV, Office documents and ZIP files are allowed");
        }
        String key = HexFormat.of().formatHex(randomBytes());
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, dir.resolve(key), StandardCopyOption.REPLACE_EXISTING);
        }
        var saved = attachments.insert(me.id(), cleanName(file.getOriginalFilename()), type, file.getSize(), key);
        return Map.of("attachment", saved.info());
    }

    /** File details for a list of ids (used for daily updates). Ids the caller can't see are left out. */
    @GetMapping
    public Map<String, List<AttachmentRepository.Info>> list(@RequestParam List<Long> ids) {
        AuthUser me = SecuritySupport.currentUser();
        return Map.of("attachments", attachments.findByIds(ids.stream().limit(50).toList()).stream()
                .filter(a -> canRead(me, a))
                .map(AttachmentRepository.Attachment::info)
                .toList());
    }

    @GetMapping("/{id}/file")
    public ResponseEntity<Resource> download(@PathVariable long id) {
        AuthUser me = SecuritySupport.currentUser();
        var a = attachments.findById(id).filter(x -> canRead(me, x))
                .orElseThrow(() -> new ApiException(404, "File not found"));
        Path path = dir.resolve(a.storageKey()).normalize();
        if (!path.startsWith(dir) || !Files.exists(path)) {
            throw new ApiException(404, "File not found");
        }
        boolean inline = a.contentType().startsWith("image/");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        (inline ? ContentDisposition.inline() : ContentDisposition.attachment())
                                .filename(a.filename()).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .body(new FileSystemResource(path));
    }

    /** Uploader and managers can read a file; so can the person who raised the issue it belongs to. */
    private boolean canRead(AuthUser me, AttachmentRepository.Attachment a) {
        if (me.isManager() || a.uploaderId() == me.id()) {
            return true;
        }
        if (a.ownerId() == null) {
            return false;
        }
        return switch (a.ownerType()) {
            case "issue" -> issues.raisedBy(a.ownerId()) == me.id();
            case "reply" -> issues.raisedByForReply(a.ownerId()) == me.id();
            default -> false;
        };
    }

    /** Trusts the file's first bytes over the browser's claim for common types. */
    private static String detectType(MultipartFile file) throws IOException {
        byte[] head;
        try (InputStream in = file.getInputStream()) {
            head = in.readNBytes(8);
        }
        if (startsWith(head, 0x89, 'P', 'N', 'G')) return "image/png";
        if (startsWith(head, 0xFF, 0xD8, 0xFF)) return "image/jpeg";
        if (startsWith(head, 'G', 'I', 'F', '8')) return "image/gif";
        if (startsWith(head, '%', 'P', 'D', 'F')) return "application/pdf";
        String claimed = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (startsWith(head, 'R', 'I', 'F', 'F')) return claimed.equals("image/webp") ? claimed : "application/octet-stream";
        if (startsWith(head, 'P', 'K', 3, 4)) {
            // Office documents are ZIP files underneath.
            return claimed.startsWith("application/vnd.openxmlformats") ? claimed : "application/zip";
        }
        if (claimed.equals("text/plain") || claimed.equals("text/csv")) return claimed;
        return "application/octet-stream";
    }

    private static boolean startsWith(byte[] data, int... prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if ((data[i] & 0xFF) != (prefix[i] & 0xFF)) return false;
        }
        return true;
    }

    private static byte[] randomBytes() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return bytes;
    }

    private static String cleanName(String name) {
        String base = name == null ? "file" : Path.of(name).getFileName().toString();
        base = base.replaceAll("[\\r\\n\"\\\\/]", "_");
        return base.isBlank() ? "file" : base.length() > 200 ? base.substring(base.length() - 200) : base;
    }

    static List<Long> ids(Long[] ids) {
        return ids == null ? List.of() : Arrays.asList(ids);
    }
}
