# Runbook

## Deployment

### Build Production App

```bash
# Build Tauri application
npm run tauri:build

# Output location
# macOS: src-tauri/target/release/bundle/macos/Agents Office.app
# Windows: src-tauri/target/release/bundle/msi/
# Linux: src-tauri/target/release/bundle/deb/
```

### Create macOS Distribution

```bash
# Create zip for distribution
npm run zip
# Output: Agents-Office-macos.zip
```

### Publish to npm (CLI)

```bash
npm publish --access public
```

## Monitoring

### Log Locations

The app monitors these directories:
- `~/.claude/debug/*.txt` - Claude Code debug logs
- `~/.claude/projects/**/*` - Claude Code project files

### Health Checks

1. **App launches correctly**
   - Window appears with office visualization
   - No Rust panics in console

2. **File watcher active**
   - Top status bar shows "Watching" or "Idle"
   - Agents respond to Claude Code activity

3. **Event flow working**
   - Speech bubbles appear on tool calls
   - Documents fly between agents on agent switches

## Common Issues

### Issue: App doesn't start

**Symptoms**: Window doesn't appear, or crashes immediately

**Solutions**:
1. Check Rust is installed: `rustc --version`
2. Rebuild Tauri app: `npm run tauri:build`
3. Check for panics in terminal output

### Issue: Agents not responding

**Symptoms**: Agents stay idle despite Claude Code activity

**Solutions**:
1. Verify Claude Code is running and generating logs
2. Check `~/.claude/debug/` has recent `.txt` files
3. Restart the app to reinitialize file watcher

### Issue: Browser mode errors

**Symptoms**: Errors when running `npm run dev` in browser

**Cause**: Tauri API not available in browser environment

**Solution**: Use `npm run tauri:dev` for full functionality, or accept limited browser preview mode

### Issue: Rate limit indicator stays on

**Symptoms**: "LIMIT" indicator in HUD doesn't clear

**Solutions**:
1. Wait for Claude API rate limit to reset
2. Check Claude Code isn't hitting rate limits
3. Restart app to clear stale state

### Issue: Document transfer animation stuck

**Symptoms**: Flying documents freeze mid-animation

**Solution**: Restart the app to reset animation state

## Rollback Procedures

### Rollback npm Package

```bash
npm unpublish @j-ho/agents-office@<version>
npm publish --access public  # republish previous version
```

### Rollback Local Build

```bash
git checkout <previous-commit>
npm install
npm run tauri:build
```

## Performance Tuning

### File Watcher

The file watcher uses 200ms debounce. Adjust in `src-tauri/src/watcher/log_watcher.rs` if needed.

### Animation Frame Rate

RAF loop throttled to ~30fps. Adjust `33ms` interval in `useNowRaf.ts` for different targets.

### Context Window

Avoid operations when context exceeds 80% for:
- Large-scale refactoring
- Multi-file feature implementation

## Contact

- Issues: https://github.com/awesomelon/agents-office/issues
- Repository: https://github.com/awesomelon/agents-office
